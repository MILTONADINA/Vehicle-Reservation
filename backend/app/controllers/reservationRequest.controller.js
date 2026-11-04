import db from "../models/index.js";
import logger from "../config/logger.js";
import { safeMessage } from "../authorization/authorization.js";
import { changeReservationRequestStatus } from "../reservationRequests/changeStatus.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MILES_PATTERN = /^\d+(\.\d)?$/;
const NOTE_TYPES = new Set(["general", "special_instructions", "other"]);

const requestPayload = (r) => ({
  id: r.id,
  requestorUserId: r.requestorUserId,
  areaId: r.areaId,
  driverId: r.driverId,
  destinationId: r.destinationId,
  destinationCity: r.destinationCity,
  estimatedMiles: r.estimatedMiles !== null ? Number(r.estimatedMiles) : null,
  departureDate: r.departureDate,
  departureTime: r.departureTime,
  returnDate: r.returnDate,
  returnTime: r.returnTime,
  passengers: r.passengers,
  purpose: r.purpose,
  noteType: r.noteType,
  noteText: r.noteText,
  status: r.status,
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

const isValidTime = (value) => typeof value === "string" && TIME_PATTERN.test(value);

const parseId = (raw) => {
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  return null;
};

const parsePositiveInt = (value) => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  return null;
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

const err = (status, message) => ({ error: true, status, message });
const INVALID = err(400, "Invalid reservation request data.");

const invalidRouteId = (res) => res.status(400).send({ message: "Reservation request id must be a positive integer." });
const notFound = (res, id) => res.status(404).send({ message: `Reservation request with id=${id} not found.` });
const failed = (res, operation, error) => {
  logger.error(`Reservation request ${operation} failed: ${safeMessage(error)}`);
  return res.status(500).send({ message: "Reservation request failed." });
};

async function validateWritableFields(body) {
  const areaId = parsePositiveInt(body?.areaId);
  if (areaId === null) return INVALID;

  const driverId = parsePositiveInt(body?.driverId);
  if (driverId === null) return INVALID;

  // Destination mode: catalog (a) or free-text (b)
  const hasDestinationId = body?.destinationId !== null && body?.destinationId !== undefined;
  const hasCity = body?.destinationCity !== null && body?.destinationCity !== undefined;
  const hasMiles = body?.estimatedMiles !== null && body?.estimatedMiles !== undefined;

  let destinationId = null;
  let destinationCity = null;
  let estimatedMiles = null;

  if (hasDestinationId && (hasCity || hasMiles)) {
    return INVALID;
  }

  if (hasDestinationId) {
    destinationId = parsePositiveInt(body.destinationId);
    if (destinationId === null) return INVALID;
  } else if (hasCity || hasMiles) {
    if (!hasCity || !hasMiles) return INVALID;
    destinationCity = trimmed(body.destinationCity, 100);
    if (!destinationCity) return INVALID;
    estimatedMiles = parseMiles(body.estimatedMiles);
    if (estimatedMiles === null) return INVALID;
  } else {
    return INVALID;
  }

  // Schedule validation
  if (!isCalendarDate(body?.departureDate) || !isCalendarDate(body?.returnDate)) {
    return INVALID;
  }
  const departureDate = body.departureDate;
  const returnDate = body.returnDate;

  const hasDepTime = body?.departureTime !== null && body?.departureTime !== undefined;
  const hasRetTime = body?.returnTime !== null && body?.returnTime !== undefined;

  let departureTime = null;
  let returnTime = null;

  if (!hasDepTime && !hasRetTime) {
    if (returnDate < departureDate) return INVALID;
  } else if (hasDepTime && hasRetTime) {
    if (!isValidTime(body.departureTime) || !isValidTime(body.returnTime)) return INVALID;
    departureTime = body.departureTime;
    returnTime = body.returnTime;
    const depCombined = `${departureDate}T${departureTime}`;
    const retCombined = `${returnDate}T${returnTime}`;
    if (retCombined <= depCombined) return INVALID;
  } else {
    return INVALID;
  }

  // Passengers 1-15
  const passengers = typeof body?.passengers === "number" && Number.isInteger(body.passengers) ? body.passengers : null;
  if (passengers === null || passengers < 1 || passengers > 15) return INVALID;

  // Purpose
  const purpose = trimmed(body?.purpose, 500);
  if (!purpose) return INVALID;

  // Notes: optional pair
  const hasNoteType = body?.noteType !== null && body?.noteType !== undefined;
  const hasNoteText = body?.noteText !== null && body?.noteText !== undefined;
  let noteType = null;
  let noteText = null;
  if (hasNoteType || hasNoteText) {
    if (!hasNoteType || !hasNoteText) return INVALID;
    if (typeof body.noteType !== "string" || !NOTE_TYPES.has(body.noteType)) return INVALID;
    noteType = body.noteType;
    noteText = trimmed(body.noteText, 1000);
    if (!noteText) return INVALID;
  }

  // Verify area exists
  const areaRecord = await db.area.findByPk(areaId);
  if (!areaRecord) return err(404, `Area with id=${areaId} not found.`);

  // Verify driver exists and is approved
  const driverRecord = await db.driver.findByPk(driverId);
  if (!driverRecord) return err(404, `Driver with id=${driverId} not found.`);
  if (driverRecord.status !== "approved") return INVALID;

  // Verify destination if catalog mode
  if (destinationId !== null) {
    const destinationRecord = await db.destination.findByPk(destinationId);
    if (!destinationRecord) return err(404, `Destination with id=${destinationId} not found.`);
    if (destinationRecord.status !== "active") return INVALID;
  }

  return {
    areaId,
    driverId,
    destinationId,
    destinationCity,
    estimatedMiles,
    departureDate,
    departureTime,
    returnDate,
    returnTime,
    passengers,
    purpose,
    noteType,
    noteText,
  };
}

const controller = {};

controller.list = async (req, res) => {
  try {
    const where = {};
    if (req.user.role === "requestor") {
      where.requestorUserId = req.user.id;
    } else if (req.user.role === "area_admin") {
      if (req.user.areaId === null) {
        return res.status(200).send([]);
      }
      where.areaId = req.user.areaId;
    }

    const requests = await db.reservationRequest.findAll({
      where,
      order: [
        ["departureDate", "ASC"],
        [db.sequelize.fn("ISNULL", db.sequelize.col("departureTime")), "DESC"],
        ["departureTime", "ASC"],
        ["id", "ASC"],
      ],
    });
    return res.status(200).send(requests.map(requestPayload));
  } catch (error) {
    return failed(res, "list", error);
  }
};

controller.create = async (req, res) => {
  try {
    const result = await validateWritableFields(req.body);
    if (result.error) return res.status(result.status).send({ message: result.message });
    const request = await db.reservationRequest.create({
      ...result,
      requestorUserId: req.user.id,
      status: "requested",
    });
    return res.status(201).send(requestPayload(request));
  } catch (error) {
    return failed(res, "create", error);
  }
};

controller.update = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return invalidRouteId(res);

  try {
    const result = await validateWritableFields(req.body);
    if (result.error) return res.status(result.status).send({ message: result.message });

    const request = await db.reservationRequest.findOne({
      where: { id, requestorUserId: req.user.id, status: "requested" },
    });
    if (!request) return notFound(res, id);

    await request.update(result);
    return res.status(200).send(requestPayload(request));
  } catch (error) {
    return failed(res, "update", error);
  }
};

controller.cancel = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return invalidRouteId(res);

  try {
    const updated = await changeReservationRequestStatus(id, "cancelled", {
      requestorUserId: req.user.id,
      status: "requested",
    });
    if (!updated) return notFound(res, id);
    return res.status(200).send(requestPayload(updated));
  } catch (error) {
    return failed(res, "cancel", error);
  }
};

export default controller;
