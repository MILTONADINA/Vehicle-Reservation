import db from "../models/index.js";
import logger from "../config/logger.js";
import { safeMessage } from "../authorization/authorization.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SERVICE_TYPES = new Set(["repair", "oil_change", "tire_replacement"]);
const NOTE_LIMIT = 1000;
const MILEAGE_MAX = 2_000_000;

const vehicleSummary = (vehicle) => ({
  id: vehicle.id,
  make: vehicle.make,
  model: vehicle.model,
  year: vehicle.year,
  plateNumber: vehicle.plateNumber,
  color: vehicle.color,
  areaId: vehicle.areaId,
});

const mileagePayload = (row) => ({
  id: row.id,
  vehicleId: row.vehicleId,
  logDate: row.logDate,
  mileage: row.mileage,
  loggedByUserId: row.loggedByUserId,
  createdAt: row.createdAt,
});

const servicePayload = (row) => ({
  id: row.id,
  vehicleId: row.vehicleId,
  serviceDate: row.serviceDate,
  serviceType: row.serviceType,
  note: row.note ?? null,
  loggedByUserId: row.loggedByUserId,
  createdAt: row.createdAt,
});

const parseVehicleId = (raw) => {
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  return null;
};

const isCalendarDate = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const normalizeNote = (value) => {
  if (value === undefined || value === null) return { ok: true, note: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, note: null };
  if (trimmed.length > NOTE_LIMIT) return { ok: false };
  return { ok: true, note: trimmed };
};

const validateMileageBody = (body) => {
  if (!isCalendarDate(body?.logDate)) return null;
  if (!Number.isInteger(body?.mileage)) return null;
  if (body.mileage < 0 || body.mileage > MILEAGE_MAX) return null;
  return { logDate: body.logDate, mileage: body.mileage };
};

const validateServiceBody = (body) => {
  if (!isCalendarDate(body?.serviceDate)) return null;
  const serviceType = typeof body?.serviceType === "string" ? body.serviceType : null;
  if (!serviceType || !SERVICE_TYPES.has(serviceType)) return null;
  const noteResult = normalizeNote(body?.note);
  if (!noteResult.ok) return null;
  return { serviceDate: body.serviceDate, serviceType, note: noteResult.note };
};

const invalidVehicleId = (res) =>
  res.status(400).send({ message: "Vehicle id must be a positive integer." });
const vehicleNotFound = (res, id) =>
  res.status(404).send({ message: `Vehicle with id=${id} not found.` });
const invalidMileage = (res) => res.status(400).send({ message: "Invalid mileage data." });
const invalidService = (res) => res.status(400).send({ message: "Invalid service log data." });
const mileageFailed = (res, operation, error) => {
  logger.error(`Mileage ${operation} failed: ${safeMessage(error)}`);
  return res.status(500).send({ message: "Mileage request failed." });
};
const serviceFailed = (res, operation, error) => {
  logger.error(`Service log ${operation} failed: ${safeMessage(error)}`);
  return res.status(500).send({ message: "Service log request failed." });
};

async function requireVehicle(vehicleId, res) {
  const vehicle = await db.vehicle.findByPk(vehicleId);
  if (!vehicle) {
    vehicleNotFound(res, vehicleId);
    return null;
  }
  return vehicle;
}

const controller = {};

controller.listVehicles = async (req, res) => {
  try {
    const rows = await db.vehicle.findAll({
      attributes: ["id", "make", "model", "year", "plateNumber", "color", "areaId"],
      order: [
        ["make", "ASC"],
        ["model", "ASC"],
        ["id", "ASC"],
      ],
    });
    return res.status(200).send(rows.map(vehicleSummary));
  } catch (error) {
    logger.error(`Maintenance vehicle list failed: ${safeMessage(error)}`);
    return res.status(500).send({ message: "Mileage request failed." });
  }
};

controller.listMileage = async (req, res) => {
  const vehicleId = parseVehicleId(req.params.vehicleId);
  if (vehicleId === null) return invalidVehicleId(res);
  try {
    if (!(await requireVehicle(vehicleId, res))) return undefined;
    const rows = await db.mileageLog.findAll({
      where: { vehicleId },
      order: [
        ["logDate", "DESC"],
        ["id", "DESC"],
      ],
    });
    return res.status(200).send(rows.map(mileagePayload));
  } catch (error) {
    return mileageFailed(res, "list", error);
  }
};

controller.createMileage = async (req, res) => {
  const vehicleId = parseVehicleId(req.params.vehicleId);
  if (vehicleId === null) return invalidVehicleId(res);
  const fields = validateMileageBody(req.body);
  if (!fields) return invalidMileage(res);

  try {
    const created = await db.sequelize.transaction(async (transaction) => {
      // Lock the vehicle row so concurrent first readings (and all later writes) serialize.
      const vehicle = await db.vehicle.findByPk(vehicleId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!vehicle) return { missing: true };

      // New row gets the next id, so it sorts after every existing log on the same logDate.
      const previous = await db.mileageLog.findOne({
        where: {
          vehicleId,
          logDate: { [db.Sequelize.Op.lte]: fields.logDate },
        },
        order: [
          ["logDate", "DESC"],
          ["id", "DESC"],
        ],
        transaction,
      });
      const next = await db.mileageLog.findOne({
        where: {
          vehicleId,
          logDate: { [db.Sequelize.Op.gt]: fields.logDate },
        },
        order: [
          ["logDate", "ASC"],
          ["id", "ASC"],
        ],
        transaction,
      });
      if (previous && fields.mileage < previous.mileage) return { tooLow: true };
      if (next && fields.mileage > next.mileage) return { tooHigh: true };

      const row = await db.mileageLog.create(
        {
          vehicleId,
          logDate: fields.logDate,
          mileage: fields.mileage,
          loggedByUserId: req.user.id,
        },
        { transaction }
      );
      return { row };
    });

    if (created.missing) return vehicleNotFound(res, vehicleId);
    if (created.tooLow) {
      return res.status(409).send({ message: "Mileage cannot be lower than the latest reading." });
    }
    if (created.tooHigh) {
      return res.status(409).send({ message: "Mileage cannot be higher than the next reading." });
    }
    return res.status(201).send(mileagePayload(created.row));
  } catch (error) {
    return mileageFailed(res, "create", error);
  }
};

controller.listService = async (req, res) => {
  const vehicleId = parseVehicleId(req.params.vehicleId);
  if (vehicleId === null) return invalidVehicleId(res);
  try {
    if (!(await requireVehicle(vehicleId, res))) return undefined;
    const rows = await db.serviceLog.findAll({
      where: { vehicleId },
      order: [
        ["serviceDate", "DESC"],
        ["id", "DESC"],
      ],
    });
    return res.status(200).send(rows.map(servicePayload));
  } catch (error) {
    return serviceFailed(res, "list", error);
  }
};

controller.createService = async (req, res) => {
  const vehicleId = parseVehicleId(req.params.vehicleId);
  if (vehicleId === null) return invalidVehicleId(res);
  const fields = validateServiceBody(req.body);
  if (!fields) return invalidService(res);

  try {
    if (!(await requireVehicle(vehicleId, res))) return undefined;
    const row = await db.serviceLog.create({
      vehicleId,
      serviceDate: fields.serviceDate,
      serviceType: fields.serviceType,
      note: fields.note,
      loggedByUserId: req.user.id,
    });
    return res.status(201).send(servicePayload(row));
  } catch (error) {
    return serviceFailed(res, "create", error);
  }
};

export default controller;
