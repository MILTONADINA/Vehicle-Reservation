import db from "../models/index.js";
import logger from "../config/logger.js";
import { safeMessage } from "../authorization/authorization.js";
import { isAllowedMakeModel, optionsPayload } from "../vehicles/makeModels.js";

const LIMITS = { color: 40, plateNumber: 20, designatedParking: 200 };
const VIN_PATTERN = /^[A-Z0-9]{1,17}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const vehiclePayload = (vehicle) => ({
  id: vehicle.id,
  make: vehicle.make,
  model: vehicle.model,
  year: vehicle.year,
  vin: vehicle.vin,
  purchasedDate: vehicle.purchasedDate,
  color: vehicle.color,
  passengers: vehicle.passengers,
  plateNumber: vehicle.plateNumber,
  plateExpireMonth: vehicle.plateExpireMonth,
  designatedParking: vehicle.designatedParking,
  areaId: vehicle.areaId,
});

const trimmed = (value, limit) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= limit ? text : null;
};

const isPositiveInt = (value) => Number.isInteger(value) && value > 0 && Number.isSafeInteger(value);

const isCalendarDate = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

function validVehicleFields(body) {
  const make = typeof body?.make === "string" ? body.make : null;
  const model = typeof body?.model === "string" ? body.model : null;
  if (!make || !model || !isAllowedMakeModel(make, model)) return null;

  if (!Number.isInteger(body?.year)) return null;
  const maxYear = new Date().getFullYear() + 1;
  if (body.year < 1980 || body.year > maxYear) return null;

  const vinRaw = typeof body?.vin === "string" ? body.vin.trim().toUpperCase() : null;
  if (!vinRaw || !VIN_PATTERN.test(vinRaw)) return null;

  if (!isCalendarDate(body?.purchasedDate)) return null;

  const color = trimmed(body?.color, LIMITS.color);
  if (!color) return null;

  if (!Number.isInteger(body?.passengers) || body.passengers < 1 || body.passengers > 15) return null;

  const plateNumber = trimmed(body?.plateNumber, LIMITS.plateNumber);
  if (!plateNumber) return null;

  if (!Number.isInteger(body?.plateExpireMonth) || body.plateExpireMonth < 1 || body.plateExpireMonth > 12) return null;

  const designatedParking = trimmed(body?.designatedParking, LIMITS.designatedParking);
  if (!designatedParking) return null;

  if (!isPositiveInt(body?.areaId)) return null;

  return {
    make,
    model,
    year: body.year,
    vin: vinRaw,
    purchasedDate: body.purchasedDate,
    color,
    passengers: body.passengers,
    plateNumber,
    plateExpireMonth: body.plateExpireMonth,
    designatedParking,
    areaId: body.areaId,
  };
}

const parseVehicleId = (raw) => {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

async function vinTaken(vin, exceptId = null) {
  const where = [db.sequelize.where(db.sequelize.fn("UPPER", db.sequelize.col("vin")), vin)];
  if (exceptId !== null) where.push({ id: { [db.Sequelize.Op.ne]: exceptId } });
  return (await db.vehicle.count({ where: { [db.Sequelize.Op.and]: where } })) > 0;
}

const scopeWhere = (user) => {
  if (user.role === "admin") return {};
  return { areaId: user.areaId };
};

const invalidData = (res) => res.status(400).send({ message: "Invalid vehicle data." });
const invalidId = (res) => res.status(400).send({ message: "Vehicle id must be a positive integer." });
const vehicleNotFound = (res, id) => res.status(404).send({ message: `Vehicle with id=${id} not found.` });
const areaNotFound = (res, id) => res.status(404).send({ message: `Area with id=${id} not found.` });
const vinInUse = (res) => res.status(409).send({ message: "VIN is already in use." });
const forbidden = (res) => res.status(403).send({ message: "Forbidden." });
const failed = (res, operation, error) => {
  logger.error(`Vehicle ${operation} failed: ${safeMessage(error)}`);
  return res.status(500).send({ message: "Vehicle request failed." });
};

async function ensureAreaExists(areaId, res) {
  const area = await db.area.findByPk(areaId);
  if (!area) {
    areaNotFound(res, areaId);
    return false;
  }
  return true;
}

// Area admins may only write vehicles for their assigned area; a different body areaId is forbidden.
function areaAdminMayWriteArea(user, areaId) {
  if (user.role !== "area_admin") return true;
  if (user.areaId === null || user.areaId === undefined) return false;
  return user.areaId === areaId;
}

const controller = {};

controller.options = async (_req, res) => res.status(200).send(optionsPayload());

controller.list = async (req, res) => {
  try {
    const vehicles = await db.vehicle.findAll({
      where: scopeWhere(req.user),
      order: [["make", "ASC"], ["model", "ASC"], ["id", "ASC"]],
    });
    return res.status(200).send(vehicles.map(vehiclePayload));
  } catch (error) {
    return failed(res, "list", error);
  }
};

controller.create = async (req, res) => {
  const fields = validVehicleFields(req.body);
  if (!fields) return invalidData(res);
  if (!areaAdminMayWriteArea(req.user, fields.areaId)) return forbidden(res);
  try {
    if (!(await ensureAreaExists(fields.areaId, res))) return undefined;
    if (await vinTaken(fields.vin)) return vinInUse(res);
    const vehicle = await db.vehicle.create(fields);
    return res.status(201).send(vehiclePayload(vehicle));
  } catch (error) {
    if (error instanceof db.Sequelize.UniqueConstraintError) return vinInUse(res);
    return failed(res, "create", error);
  }
};

controller.update = async (req, res) => {
  const id = parseVehicleId(req.params.id);
  if (id === null) return invalidId(res);
  const fields = validVehicleFields(req.body);
  if (!fields) return invalidData(res);
  try {
    const vehicle = await db.vehicle.findByPk(id);
    if (!vehicle) return vehicleNotFound(res, id);
    if (req.user.role === "area_admin" && vehicle.areaId !== req.user.areaId) return vehicleNotFound(res, id);
    if (!areaAdminMayWriteArea(req.user, fields.areaId)) return forbidden(res);
    if (!(await ensureAreaExists(fields.areaId, res))) return undefined;
    if (await vinTaken(fields.vin, id)) return vinInUse(res);
    await vehicle.update(fields);
    return res.status(200).send(vehiclePayload(vehicle));
  } catch (error) {
    if (error instanceof db.Sequelize.UniqueConstraintError) return vinInUse(res);
    return failed(res, "update", error);
  }
};

controller.remove = async (req, res) => {
  const id = parseVehicleId(req.params.id);
  if (id === null) return invalidId(res);
  try {
    const vehicle = await db.vehicle.findByPk(id);
    if (!vehicle) return vehicleNotFound(res, id);
    if (req.user.role === "area_admin" && vehicle.areaId !== req.user.areaId) return vehicleNotFound(res, id);
    await vehicle.destroy();
    return res.status(200).send({ message: "Vehicle deleted." });
  } catch (error) {
    return failed(res, "delete", error);
  }
};

export default controller;
