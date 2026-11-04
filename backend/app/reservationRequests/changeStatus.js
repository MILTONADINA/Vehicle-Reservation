import db from "../models/index.js";
import { prepareStatusEmail } from "../reservationEmails/statusEmail.js";

// Allowed status transitions.
// Feature 7: requested→cancelled (requestor cancel, no extras).
// Feature 8: admin/area_admin transitions with optional vehicleId/statusReason.
const TRANSITIONS = {
  requested: new Set(["cancelled", "awaiting_vehicle", "reserved"]),
  awaiting_vehicle: new Set(["reserved", "cancelled"]),
  reserved: new Set(["returned", "cancelled"]),
};

/**
 * Shared status-change function for reservation requests.
 * Validates that the transition is allowed, updates the row, saves the requestor's status-change email job
 * (Feature 9) in the same transaction, and returns the updated instance. Without a caller transaction it
 * opens its own, so the status change and its email job always commit or roll back together.
 *
 * @param {number} id - reservation request id
 * @param {string} newStatus - target status
 * @param {object} [where] - additional Sequelize where conditions (e.g. ownership)
 * @param {object} [extras] - optional { vehicleId, statusReason, transaction } for admin transitions
 * @returns {object|null} the updated reservationRequest instance, or null if not found / not allowed
 */
export async function changeReservationRequestStatus(id, newStatus, where = {}, extras = {}) {
  if (!extras.transaction) {
    return db.sequelize.transaction((transaction) =>
      changeReservationRequestStatus(id, newStatus, where, { ...extras, transaction })
    );
  }
  const txn = extras.transaction;
  // Row lock serializes status changes with the email dispatcher's reminder eligibility check.
  const request = await db.reservationRequest.findOne({ where: { id, ...where }, lock: txn.LOCK.UPDATE, transaction: txn });
  if (!request) return null;

  const allowed = TRANSITIONS[request.status];
  if (!allowed || !allowed.has(newStatus)) return null;

  const update = { status: newStatus };

  if (newStatus === "awaiting_vehicle") {
    update.vehicleId = null;
    update.statusReason = null;
  } else if (newStatus === "reserved") {
    update.vehicleId = extras.vehicleId ?? null;
    update.statusReason = null;
  } else if (newStatus === "returned") {
    // Keep existing vehicleId
    update.statusReason = null;
  } else if (newStatus === "cancelled") {
    if (extras.vehicleId !== undefined || extras.statusReason !== undefined) {
      // Admin/area_admin cancel path
      update.vehicleId = null;
      update.statusReason = extras.statusReason ?? null;
    }
    // Feature 7 requestor cancel path: no extras passed, leave vehicleId/statusReason alone (null)
  }

  const oldStatus = request.status;
  await request.update(update, { transaction: txn });
  await prepareStatusEmail(request, oldStatus, txn);
  return request;
}
