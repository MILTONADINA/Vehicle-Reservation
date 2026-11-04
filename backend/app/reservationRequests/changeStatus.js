import db from "../models/index.js";

// Allowed status transitions. Feature 7 adds requested→cancelled.
// Feature 8 will extend this map with additional transitions.
const TRANSITIONS = {
  requested: new Set(["cancelled"]),
};

/**
 * Shared status-change function for reservation requests.
 * Validates that the transition is allowed, updates the row, and returns the updated instance.
 *
 * @param {number} id - reservation request id
 * @param {string} newStatus - target status
 * @param {object} [where] - additional Sequelize where conditions (e.g. ownership)
 * @returns {object|null} the updated reservationRequest instance, or null if not found / not allowed
 */
export async function changeReservationRequestStatus(id, newStatus, where = {}) {
  const request = await db.reservationRequest.findOne({ where: { id, ...where } });
  if (!request) return null;

  const allowed = TRANSITIONS[request.status];
  if (!allowed || !allowed.has(newStatus)) return null;

  await request.update({ status: newStatus });
  return request;
}
