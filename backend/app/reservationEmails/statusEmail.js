import db from "../models/index.js";
import { emailRuntime } from "./emailConfig.js";
import { statusChangeMessage } from "./messages.js";

/**
 * Saves the pending status-change job for a transition inside the caller's status transaction,
 * so the status change and its notification commit or roll back together.
 */
export async function prepareStatusEmail(request, oldStatus, transaction) {
  const options = { transaction };
  const requestor = await db.user.findByPk(request.requestorUserId, options);
  const area = await db.area.findByPk(request.areaId, options);
  const vehicle = request.vehicleId ? await db.vehicle.findByPk(request.vehicleId, options) : null;
  const changedAt = emailRuntime.now();
  const { subject, body } = statusChangeMessage({
    request,
    area,
    vehicle,
    oldStatus,
    newStatus: request.status,
    changedAt,
  });
  return db.reservationEmail.create(
    {
      reservationRequestId: request.id,
      kind: "status_change",
      notificationKey: request.status,
      recipient: requestor.email,
      subject,
      body,
      deliveryState: "pending",
      attemptCount: 0,
      nextAttemptAt: changedAt,
      sentAt: null,
    },
    options
  );
}
