import db from "../models/index.js";
import logger from "../config/logger.js";
import { safeMessage } from "../authorization/authorization.js";

const ISSUE_TYPES = new Set(["low_gas", "dirty", "maintenance_need"]);
const TIMINGS = new Set(["before", "during", "after"]);
const NOTE_LIMIT = 1000;

const issuePayload = (issue) => ({
  id: issue.id,
  requestId: issue.requestId,
  vehicleId: issue.vehicleId ?? null,
  issueType: issue.issueType,
  timing: issue.timing,
  note: issue.note ?? null,
  reportedByUserId: issue.reportedByUserId,
  createdAt: issue.createdAt,
});

const parseRequestId = (raw) => {
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  return null;
};

const normalizeNote = (value) => {
  if (value === undefined || value === null) return { ok: true, note: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, note: null };
  if (trimmed.length > NOTE_LIMIT) return { ok: false };
  return { ok: true, note: trimmed };
};

const validateCreateBody = (body) => {
  const issueType = typeof body?.issueType === "string" ? body.issueType : null;
  const timing = typeof body?.timing === "string" ? body.timing : null;
  if (!issueType || !ISSUE_TYPES.has(issueType)) return null;
  if (!timing || !TIMINGS.has(timing)) return null;
  const noteResult = normalizeNote(body?.note);
  if (!noteResult.ok) return null;
  return { issueType, timing, note: noteResult.note };
};

const invalidRouteId = (res) =>
  res.status(400).send({ message: "Reservation request id must be a positive integer." });
const invalidData = (res) => res.status(400).send({ message: "Invalid issue data." });
const notFound = (res, id) =>
  res.status(404).send({ message: `Reservation request with id=${id} not found.` });
const failed = (res, operation, error) => {
  logger.error(`Issue ${operation} failed: ${safeMessage(error)}`);
  return res.status(500).send({ message: "Issue request failed." });
};

// Returns the request when the caller may act on it; null means respond with the shared 404.
async function findScopedRequest(user, requestId) {
  const reservationRequest = await db.reservationRequest.findByPk(requestId);
  if (!reservationRequest) return null;

  if (user.role === "admin") return reservationRequest;

  if (user.role === "area_admin") {
    if (user.areaId === null || user.areaId === undefined) return null;
    if (reservationRequest.areaId !== user.areaId) return null;
    return reservationRequest;
  }

  if (user.role === "requestor") {
    if (reservationRequest.requestorUserId !== user.id) return null;
    return reservationRequest;
  }

  return null;
}

const controller = {};

controller.createForRequest = async (req, res) => {
  const requestId = parseRequestId(req.params.id);
  if (requestId === null) return invalidRouteId(res);

  const fields = validateCreateBody(req.body);
  if (!fields) return invalidData(res);

  try {
    const reservationRequest = await findScopedRequest(req.user, requestId);
    if (!reservationRequest) return notFound(res, requestId);

    const issue = await db.issueReport.create({
      requestId: reservationRequest.id,
      vehicleId: reservationRequest.vehicleId ?? null,
      issueType: fields.issueType,
      timing: fields.timing,
      note: fields.note,
      reportedByUserId: req.user.id,
    });
    return res.status(201).send(issuePayload(issue));
  } catch (error) {
    return failed(res, "create", error);
  }
};

controller.listForRequest = async (req, res) => {
  const requestId = parseRequestId(req.params.id);
  if (requestId === null) return invalidRouteId(res);

  try {
    const reservationRequest = await findScopedRequest(req.user, requestId);
    if (!reservationRequest) return notFound(res, requestId);

    const issues = await db.issueReport.findAll({
      where: { requestId },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });
    return res.status(200).send(issues.map(issuePayload));
  } catch (error) {
    return failed(res, "list-for-request", error);
  }
};

controller.listOpen = async (req, res) => {
  try {
    const where = {};
    if (req.user.role === "area_admin") {
      if (req.user.areaId === null || req.user.areaId === undefined) {
        return res.status(200).send([]);
      }
      const requestIds = (
        await db.reservationRequest.findAll({
          attributes: ["id"],
          where: { areaId: req.user.areaId },
        })
      ).map((row) => row.id);
      if (requestIds.length === 0) return res.status(200).send([]);
      where.requestId = { [db.Sequelize.Op.in]: requestIds };
    } else if (req.user.role === "maintenance") {
      where.issueType = "maintenance_need";
    }

    const issues = await db.issueReport.findAll({
      where,
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });
    return res.status(200).send(issues.map(issuePayload));
  } catch (error) {
    return failed(res, "list-open", error);
  }
};

export default controller;
