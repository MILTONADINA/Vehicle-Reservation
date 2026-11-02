import db from "../models/index.js";
import logger from "../config/logger.js";
import { safeMessage } from "../authorization/authorization.js";
import { isLicenseState, optionsPayload } from "../drivers/licenseStates.js";

const LIMITS = { name: 100 };
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(["approved", "inactive"]);

const driverPayload = (driver) => ({
  id: driver.id,
  firstName: driver.firstName,
  lastName: driver.lastName,
  licenseState: driver.licenseState,
  licenseExpireDate: driver.licenseExpireDate,
  approvedDate: driver.approvedDate,
  status: driver.status,
});

const trimmed = (value, limit) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= limit ? text : null;
};

const isCalendarDate = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

function validDriverFields(body) {
  const firstName = trimmed(body?.firstName, LIMITS.name);
  const lastName = trimmed(body?.lastName, LIMITS.name);
  if (!firstName || !lastName) return null;

  const licenseRaw = typeof body?.licenseState === "string" ? body.licenseState.trim().toUpperCase() : null;
  if (!licenseRaw || !isLicenseState(licenseRaw)) return null;

  if (!isCalendarDate(body?.licenseExpireDate) || !isCalendarDate(body?.approvedDate)) return null;

  const status = typeof body?.status === "string" ? body.status.trim() : null;
  if (!status || !STATUSES.has(status)) return null;

  return {
    firstName,
    lastName,
    licenseState: licenseRaw,
    licenseExpireDate: body.licenseExpireDate,
    approvedDate: body.approvedDate,
    status,
  };
}

const parseDriverId = (raw) => {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const invalidData = (res) => res.status(400).send({ message: "Invalid driver data." });
const invalidId = (res) => res.status(400).send({ message: "Driver id must be a positive integer." });
const driverNotFound = (res, id) => res.status(404).send({ message: `Driver with id=${id} not found.` });
const failed = (res, operation, error) => {
  logger.error(`Driver ${operation} failed: ${safeMessage(error)}`);
  return res.status(500).send({ message: "Driver request failed." });
};

const controller = {};

controller.options = async (_req, res) => res.status(200).send(optionsPayload());

controller.list = async (_req, res) => {
  try {
    const drivers = await db.driver.findAll({
      order: [["lastName", "ASC"], ["firstName", "ASC"], ["id", "ASC"]],
    });
    return res.status(200).send(drivers.map(driverPayload));
  } catch (error) {
    return failed(res, "list", error);
  }
};

controller.create = async (req, res) => {
  const fields = validDriverFields(req.body);
  if (!fields) return invalidData(res);
  try {
    const driver = await db.driver.create(fields);
    return res.status(201).send(driverPayload(driver));
  } catch (error) {
    return failed(res, "create", error);
  }
};

controller.update = async (req, res) => {
  const id = parseDriverId(req.params.id);
  if (id === null) return invalidId(res);
  const fields = validDriverFields(req.body);
  if (!fields) return invalidData(res);
  try {
    const driver = await db.driver.findByPk(id);
    if (!driver) return driverNotFound(res, id);
    await driver.update(fields);
    return res.status(200).send(driverPayload(driver));
  } catch (error) {
    return failed(res, "update", error);
  }
};

controller.remove = async (req, res) => {
  const id = parseDriverId(req.params.id);
  if (id === null) return invalidId(res);
  try {
    const driver = await db.driver.findByPk(id);
    if (!driver) return driverNotFound(res, id);
    await driver.destroy();
    return res.status(200).send({ message: "Driver deleted." });
  } catch (error) {
    return failed(res, "delete", error);
  }
};

export default controller;
