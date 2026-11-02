import db from "../models/index.js";
import logger from "../config/logger.js";
import { safeMessage } from "../authorization/authorization.js";
import { isState, optionsPayload } from "../destinations/states.js";

const LIMITS = { destinationName: 100, addressLine: 200, city: 100 };
const ZIP_PATTERN = /^\d{5}$/;
const MILES_PATTERN = /^\d+(\.\d)?$/;
const STATUSES = new Set(["active", "inactive"]);

const destinationPayload = (destination) => ({
  id: destination.id,
  destinationName: destination.destinationName,
  addressLine: destination.addressLine,
  city: destination.city,
  state: destination.state,
  zipCode: destination.zipCode,
  roundTripMiles: Number(destination.roundTripMiles),
  status: destination.status,
});

const trimmed = (value, limit) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= limit ? text : null;
};

const parseMiles = (value) => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    value = String(value);
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!MILES_PATTERN.test(text)) return null;
  const miles = Number(text);
  if (!(miles > 0 && miles <= 9999.9)) return null;
  return miles;
};

function validDestinationFields(body) {
  const destinationName = trimmed(body?.destinationName, LIMITS.destinationName);
  const addressLine = trimmed(body?.addressLine, LIMITS.addressLine);
  const city = trimmed(body?.city, LIMITS.city);
  if (!destinationName || !addressLine || !city) return null;

  const stateRaw = typeof body?.state === "string" ? body.state.trim().toUpperCase() : null;
  if (!stateRaw || !isState(stateRaw)) return null;

  const zipCode = typeof body?.zipCode === "string" ? body.zipCode.trim() : null;
  if (!zipCode || !ZIP_PATTERN.test(zipCode)) return null;

  const roundTripMiles = parseMiles(body?.roundTripMiles);
  if (roundTripMiles === null) return null;

  const status = typeof body?.status === "string" ? body.status.trim() : null;
  if (!status || !STATUSES.has(status)) return null;

  return { destinationName, addressLine, city, state: stateRaw, zipCode, roundTripMiles, status };
}

const parseDestinationId = (raw) => {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

async function nameTaken(destinationName, exceptId = null) {
  const where = [
    db.sequelize.where(
      db.sequelize.fn("LOWER", db.sequelize.col("destinationName")),
      destinationName.toLowerCase()
    ),
  ];
  if (exceptId !== null) where.push({ id: { [db.Sequelize.Op.ne]: exceptId } });
  return (await db.destination.count({ where: { [db.Sequelize.Op.and]: where } })) > 0;
}

const invalidData = (res) => res.status(400).send({ message: "Invalid destination data." });
const invalidId = (res) => res.status(400).send({ message: "Destination id must be a positive integer." });
const destinationNotFound = (res, id) => res.status(404).send({ message: `Destination with id=${id} not found.` });
const nameInUse = (res) => res.status(409).send({ message: "Destination name is already in use." });
const failed = (res, operation, error) => {
  logger.error(`Destination ${operation} failed: ${safeMessage(error)}`);
  return res.status(500).send({ message: "Destination request failed." });
};

const controller = {};

controller.options = async (_req, res) => res.status(200).send(optionsPayload());

controller.list = async (_req, res) => {
  try {
    const destinations = await db.destination.findAll({
      order: [["destinationName", "ASC"], ["id", "ASC"]],
    });
    return res.status(200).send(destinations.map(destinationPayload));
  } catch (error) {
    return failed(res, "list", error);
  }
};

controller.create = async (req, res) => {
  const fields = validDestinationFields(req.body);
  if (!fields) return invalidData(res);
  try {
    if (await nameTaken(fields.destinationName)) return nameInUse(res);
    const destination = await db.destination.create(fields);
    return res.status(201).send(destinationPayload(destination));
  } catch (error) {
    if (error instanceof db.Sequelize.UniqueConstraintError) return nameInUse(res);
    return failed(res, "create", error);
  }
};

controller.update = async (req, res) => {
  const id = parseDestinationId(req.params.id);
  if (id === null) return invalidId(res);
  const fields = validDestinationFields(req.body);
  if (!fields) return invalidData(res);
  try {
    const destination = await db.destination.findByPk(id);
    if (!destination) return destinationNotFound(res, id);
    if (await nameTaken(fields.destinationName, id)) return nameInUse(res);
    await destination.update(fields);
    return res.status(200).send(destinationPayload(destination));
  } catch (error) {
    if (error instanceof db.Sequelize.UniqueConstraintError) return nameInUse(res);
    return failed(res, "update", error);
  }
};

controller.remove = async (req, res) => {
  const id = parseDestinationId(req.params.id);
  if (id === null) return invalidId(res);
  try {
    const destination = await db.destination.findByPk(id);
    if (!destination) return destinationNotFound(res, id);
    await destination.destroy();
    return res.status(200).send({ message: "Destination deleted." });
  } catch (error) {
    if (error instanceof db.Sequelize.ForeignKeyConstraintError) {
      return res.status(409).send({ message: "Destination is in use." });
    }
    return failed(res, "delete", error);
  }
};

export default controller;
