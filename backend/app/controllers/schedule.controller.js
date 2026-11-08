import db from "../models/index.js";
import logger from "../config/logger.js";
import { safeMessage } from "../authorization/authorization.js";
import {
  effectiveReturnMs,
  isMonday,
  mondayOf,
  requestOverlapsWeek,
  weekBoundsMs,
} from "../schedule/weekRange.js";

const scheduleItem = (request) => {
  const requestor = request.requestor;
  const vehicle = request.vehicle;
  let requestorName = null;
  if (requestor?.firstName != null && requestor?.lastName != null) {
    requestorName = `${requestor.firstName} ${requestor.lastName}`.trim() || null;
  }
  let vehicleLabel = null;
  if (vehicle) {
    vehicleLabel = `${vehicle.make} ${vehicle.model} · ${vehicle.plateNumber}`;
  }
  return {
    id: request.id,
    areaId: request.areaId,
    status: request.status,
    departureDate: request.departureDate,
    departureTime: request.departureTime ?? null,
    returnDate: request.returnDate,
    returnTime: request.returnTime ?? null,
    requestorUserId: request.requestorUserId,
    requestorName,
    vehicleId: request.vehicleId ?? null,
    vehicleLabel,
  };
};

const sortItems = (items) =>
  items.sort((a, b) => {
    if (a.departureDate !== b.departureDate) return a.departureDate < b.departureDate ? -1 : 1;
    const at = a.departureTime;
    const bt = b.departureTime;
    if (at === null && bt !== null) return -1;
    if (at !== null && bt === null) return 1;
    if (at !== null && bt !== null && at !== bt) return at < bt ? -1 : 1;
    return a.id - b.id;
  });

const parsePositiveInt = (raw) => {
  if (raw === undefined || raw === null || raw === "") return { kind: "absent" };
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return { kind: "invalid" };
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) return { kind: "invalid" };
  return { kind: "ok", id };
};

async function resolveAreaScope(user, queryAreaId) {
  if (user.role === "area_admin") {
    if (user.areaId === null || user.areaId === undefined) return { empty: true };
    return { where: { areaId: user.areaId } };
  }
  // admin
  const parsed = parsePositiveInt(queryAreaId);
  if (parsed.kind === "invalid") return { error: { status: 400, message: "Area id must be a positive integer." } };
  if (parsed.kind === "absent") return { where: {} };
  const area = await db.area.findByPk(parsed.id);
  if (!area) return { error: { status: 404, message: `Area with id=${parsed.id} not found.` } };
  return { where: { areaId: parsed.id } };
}

const includeRequestorVehicle = [
  { model: db.user, as: "requestor", attributes: ["id", "firstName", "lastName"] },
  { model: db.vehicle, as: "vehicle", attributes: ["id", "make", "model", "plateNumber"], required: false },
];

const failed = (res, kind, error) => {
  logger.error(`${kind} failed: ${safeMessage(error)}`);
  const message = kind === "Schedule" ? "Schedule request failed." : "Service queue request failed.";
  return res.status(500).send({ message });
};

const controller = {};

controller.schedule = async (req, res) => {
  try {
    let weekStart = req.query.weekStart;
    if (weekStart === undefined || weekStart === null || weekStart === "") {
      weekStart = mondayOf(new Date());
    } else if (!isMonday(weekStart)) {
      return res.status(400).send({ message: "Invalid schedule data." });
    }

    const scope = await resolveAreaScope(req.user, req.query.areaId);
    if (scope.error) return res.status(scope.error.status).send({ message: scope.error.message });
    if (scope.empty) {
      const { weekEnd } = weekBoundsMs(weekStart);
      return res.status(200).send({ weekStart, weekEnd, items: [] });
    }

    const { weekEnd, startMs, endMs } = weekBoundsMs(weekStart);
    const rows = await db.reservationRequest.findAll({
      where: {
        ...scope.where,
        status: { [db.Sequelize.Op.ne]: "cancelled" },
        // Coarse calendar filter; exact overlap (including times) is applied below.
        departureDate: { [db.Sequelize.Op.lte]: weekEnd },
        returnDate: { [db.Sequelize.Op.gte]: weekStart },
      },
      include: includeRequestorVehicle,
    });

    const items = sortItems(
      rows.filter((row) => requestOverlapsWeek(row, startMs, endMs)).map(scheduleItem)
    );
    return res.status(200).send({ weekStart, weekEnd, items });
  } catch (error) {
    return failed(res, "Schedule", error);
  }
};

controller.serviceQueue = async (req, res) => {
  try {
    const scope = await resolveAreaScope(req.user, req.query.areaId);
    if (scope.error) return res.status(scope.error.status).send({ message: scope.error.message });
    if (scope.empty) {
      return res.status(200).send({ needVehicle: [], needCheckIn: [] });
    }

    const now = Date.now();
    const rows = await db.reservationRequest.findAll({
      where: {
        ...scope.where,
        status: { [db.Sequelize.Op.in]: ["awaiting_vehicle", "reserved"] },
      },
      include: includeRequestorVehicle,
    });

    const needVehicle = sortItems(
      rows.filter((row) => row.status === "awaiting_vehicle").map(scheduleItem)
    );
    const needCheckIn = sortItems(
      rows
        .filter((row) => row.status === "reserved" && effectiveReturnMs(row) < now)
        .map(scheduleItem)
    );
    return res.status(200).send({ needVehicle, needCheckIn });
  } catch (error) {
    return failed(res, "Service queue", error);
  }
};

export default controller;
