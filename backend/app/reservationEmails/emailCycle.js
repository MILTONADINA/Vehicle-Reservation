import db from "../models/index.js";
import logger from "../config/logger.js";
import { emailRuntime, readSmtpConfig } from "./emailConfig.js";
import { campusParts, addCalendarDays, reminderDepartureDate, REMINDER_START_HOUR } from "./campusClock.js";
import { pickupReminderMessage } from "./messages.js";

export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 5 * 60 * 1000;
export const LEASE_RENEW_MS = 60 * 1000;

const { Op, UniqueConstraintError } = db.Sequelize;

/** A reminder may be claimed only while its trip is reserved with a vehicle and inside its day-before window. */
function reminderStillEligible(request, departureDate, instant) {
  if (!request || request.status !== "reserved" || !request.vehicleId) return false;
  if (request.departureDate !== departureDate) return false;
  const { date, hour } = campusParts(instant);
  return addCalendarDays(date, 1) === departureDate && hour >= REMINDER_START_HOUR;
}

/** Inserts one pickup-reminder job per eligible reservation; returns how many this run inserted. */
async function prepareReminders(instant) {
  const departureDate = reminderDepartureDate(instant);
  if (!departureDate) return 0;

  const candidates = await db.reservationRequest.findAll({
    attributes: ["id"],
    where: { status: "reserved", vehicleId: { [Op.ne]: null }, departureDate },
    order: [["id", "ASC"]],
  });

  let queued = 0;
  for (const { id } of candidates) {
    const key = { reservationRequestId: id, kind: "pickup_reminder", notificationKey: departureDate };
    if (await db.reservationEmail.findOne({ where: key, attributes: ["id"] })) continue;
    try {
      const inserted = await db.sequelize.transaction(async (transaction) => {
        // Same request-row lock a status change takes, so a concurrent cancellation is observed.
        const request = await db.reservationRequest.findByPk(id, { lock: transaction.LOCK.UPDATE, transaction });
        if (!reminderStillEligible(request, departureDate, instant)) return false;
        const requestor = await db.user.findByPk(request.requestorUserId, { transaction });
        const area = await db.area.findByPk(request.areaId, { transaction });
        const vehicle = await db.vehicle.findByPk(request.vehicleId, { transaction });
        const { subject, body } = pickupReminderMessage({ request, area, vehicle });
        await db.reservationEmail.create(
          { ...key, recipient: requestor.email, subject, body, deliveryState: "pending", attemptCount: 0, nextAttemptAt: instant, sentAt: null },
          { transaction }
        );
        return true;
      });
      if (inserted) queued += 1;
    } catch (error) {
      // Another run already prepared this reminder; keep its saved message and attempts.
      if (!(error instanceof UniqueConstraintError)) throw error;
    }
  }
  return queued;
}

/**
 * Claims one due job: under row locks it rechecks the job (and, for reminders, the request), then either
 * marks a no-longer-eligible reminder skipped or records the attempt and its retry time before sending.
 * A concurrent dispatcher waiting on the same lock then finds the job not due and leaves it alone.
 */
function claimJob(due) {
  return db.sequelize.transaction(async (transaction) => {
    const instant = emailRuntime.now();
    // Lock order matches a status change: request row first, then its email rows.
    const request =
      due.kind === "pickup_reminder"
        ? await db.reservationRequest.findByPk(due.reservationRequestId, { lock: transaction.LOCK.UPDATE, transaction })
        : null;
    const job = await db.reservationEmail.findByPk(due.id, { lock: transaction.LOCK.UPDATE, transaction });
    if (!job || job.deliveryState !== "pending" || job.nextAttemptAt > instant) {
      return null;
    }
    if (job.kind === "pickup_reminder" && !reminderStillEligible(request, job.notificationKey, instant)) {
      await job.update({ deliveryState: "skipped", nextAttemptAt: null }, { transaction });
      return { outcome: "skipped", job };
    }
    if (job.attemptCount >= MAX_ATTEMPTS) {
      // The final attempt was claimed but its outcome was never recorded (process stopped or the
      // update failed). Its claim has expired: close it as failed instead of leaving it pending.
      await job.update({ deliveryState: "failed", nextAttemptAt: null }, { transaction });
      return { outcome: "failed", job };
    }
    await job.update(
      { attemptCount: job.attemptCount + 1, nextAttemptAt: new Date(instant.getTime() + RETRY_DELAY_MS) },
      { transaction }
    );
    return { outcome: "claimed", job };
  });
}

const retryAt = () => new Date(emailRuntime.now().getTime() + RETRY_DELAY_MS);

/**
 * Submits a claimed job while keeping its claim: until the submission settles, nextAttemptAt is pushed
 * five minutes ahead every minute, so no other dispatcher can claim and resubmit a job still in flight.
 * If this process stops, renewals stop and the claim expires normally.
 */
async function submitHoldingClaim(job, submit) {
  const renew = setInterval(() => {
    db.reservationEmail
      .update({ nextAttemptAt: retryAt() }, { where: { id: job.id, deliveryState: "pending", attemptCount: job.attemptCount } })
      .catch(() => logger.warn(`EMAIL_CLAIM_RENEW_FAILED id=${job.id}`));
  }, emailRuntime.leaseRenewMs ?? LEASE_RENEW_MS);
  try {
    return await submit();
  } finally {
    clearInterval(renew);
  }
}

/** Submits every due pending job once; one transport failure never stops the rest. */
async function dispatchDue(instant, transport, from, counts) {
  const due = await db.reservationEmail.findAll({
    attributes: ["id", "kind", "reservationRequestId"],
    where: { deliveryState: "pending", nextAttemptAt: { [Op.lte]: instant } },
    order: [["nextAttemptAt", "ASC"], ["id", "ASC"]],
  });

  for (const candidate of due) {
    const claim = await claimJob(candidate);
    if (!claim) continue;
    const { job } = claim;
    if (claim.outcome === "skipped") {
      counts.skipped += 1;
      logger.info(`EMAIL_SKIPPED id=${job.id} state=skipped`);
      continue;
    }
    if (claim.outcome === "failed") {
      counts.failed += 1;
      logger.warn(`EMAIL_DELIVERY_FAILED id=${job.id} state=failed attempts=${job.attemptCount}`);
      continue;
    }

    let accepted = false;
    try {
      await submitHoldingClaim(job, () => transport.sendMail({ from, to: job.recipient, subject: job.subject, text: job.body }));
      accepted = true;
    } catch {
      // Provider errors can echo addresses or credentials, so only the fixed code below is logged.
    }

    if (accepted) {
      await db.reservationEmail.update(
        { deliveryState: "sent", sentAt: emailRuntime.now(), nextAttemptAt: null },
        { where: { id: job.id, deliveryState: "pending" } }
      );
      counts.sent += 1;
      logger.info(`EMAIL_SENT id=${job.id} state=sent attempts=${job.attemptCount}`);
    } else if (job.attemptCount >= MAX_ATTEMPTS) {
      await db.reservationEmail.update(
        { deliveryState: "failed", nextAttemptAt: null },
        { where: { id: job.id, deliveryState: "pending" } }
      );
      counts.failed += 1;
      logger.warn(`EMAIL_DELIVERY_FAILED id=${job.id} state=failed attempts=${job.attemptCount}`);
    } else {
      // The retry waits five minutes from when this attempt actually ended.
      await db.reservationEmail.update({ nextAttemptAt: retryAt() }, { where: { id: job.id, deliveryState: "pending" } });
      counts.retryScheduled += 1;
      logger.warn(`EMAIL_RETRY_SCHEDULED id=${job.id} state=pending attempts=${job.attemptCount}`);
    }
  }
}

/**
 * The shared delivery cycle used by the cron job and the admin Send now trigger: check configuration,
 * prepare eligible pickup reminders, then dispatch due status emails, reminders, and retries.
 * Returns the counts of work this invocation performed.
 */
export async function runEmailCycle() {
  const config = readSmtpConfig();
  const transport = emailRuntime.createTransport(config);
  const instant = emailRuntime.now();
  const counts = { queued: 0, sent: 0, retryScheduled: 0, failed: 0, skipped: 0 };

  counts.queued = await prepareReminders(instant);
  await dispatchDue(instant, transport, config.from, counts);

  // Idle minutes stay quiet; only runs that did work are logged.
  if (Object.values(counts).some((count) => count > 0)) logger.info(
    `EMAIL_RUN_COMPLETED queued=${counts.queued} sent=${counts.sent} retryScheduled=${counts.retryScheduled} failed=${counts.failed} skipped=${counts.skipped}`
  );
  return counts;
}
