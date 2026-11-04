/**
 * Feature 9 — Reservation Emails: delivery, retries, configuration, logging, and the in-process schedule (US-9.3).
 * Spec: features/feature-9-reservation-emails.md
 */
import { jest } from "@jest/globals";
import db from "../app/models/index.js";
import logger from "../app/config/logger.js";
import { runEmailCycle, RETRY_DELAY_MS } from "../app/reservationEmails/emailCycle.js";
import { emailRuntime, SEND_TIMEOUT_MS } from "../app/reservationEmails/emailConfig.js";
import { syncTestDatabase, signInAs } from "./helpers.js";
import {
  installEmailRuntime,
  restoreEmailRuntime,
  registerOnStubCron,
  seedTrip,
  makeRequest,
  changeStatus,
  authMe,
  sendNow,
  emailRows,
  captureLogs,
  realCreateTransport,
} from "./emailFixtures.js";

const NOW = "2026-11-04T15:00:00.000Z";
const minutesAfter = (iso, minutes) => new Date(new Date(iso).getTime() + minutes * 60000);

let clock, seed, admin, scheduled;

/** A committed status transition and its pending job, prepared through the real status endpoint. */
async function committedTransition(overrides = {}) {
  const req = await makeRequest(seed, overrides);
  const response = await changeStatus(admin.token, req.id, { status: "awaiting_vehicle" });
  expect(response.status).toBe(200);
  const [job] = await emailRows({ reservationRequestId: req.id });
  return { req, job, response };
}

beforeAll(async () => {
  await syncTestDatabase();
});

beforeEach(async () => {
  await syncTestDatabase();
  clock = installEmailRuntime(NOW);
  seed = await seedTrip();
  admin = await signInAs("admin");
  scheduled = registerOnStubCron();
});

afterEach(() => {
  restoreEmailRuntime();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe("Feature 9 — Reservation Emails", () => {
  describe("US-9.3 — Recover failed email deliveries", () => {
    it("Accepted email is recorded and not sent again", async () => {
      const { job } = await committedTransition();
      expect(job).toMatchObject({ deliveryState: "pending", attemptCount: 0, sentAt: null });
      clock.advanceMinutes(1);
      expect(await scheduled.tick()).toEqual({ queued: 0, sent: 1, retryScheduled: 0, failed: 0, skipped: 0 });
      const [sent] = await emailRows();
      expect(sent).toMatchObject({ deliveryState: "sent", attemptCount: 1, nextAttemptAt: null });
      expect(sent.sentAt.toISOString()).toBe(minutesAfter(NOW, 1).toISOString());

      for (const minutes of [1, 5, 60]) {
        clock.advanceMinutes(minutes);
        await scheduled.tick();
      }
      expect(clock.transport.attempts).toHaveLength(1);
      expect((await emailRows())[0]).toEqual(sent);
    });

    it("Transport failure keeps a committed reservation update", async () => {
      const { req, response } = await committedTransition();
      expect(response.body.status).toBe("awaiting_vehicle");
      clock.transport.fail = () => true;
      expect(await scheduled.tick()).toMatchObject({ sent: 0, retryScheduled: 1, failed: 0 });

      expect((await db.reservationRequest.findByPk(req.id)).status).toBe("awaiting_vehicle");
      const [job] = await emailRows();
      expect(job).toMatchObject({ deliveryState: "pending", attemptCount: 1, sentAt: null });
      expect(job.nextAttemptAt.toISOString()).toBe(minutesAfter(NOW, 5).toISOString());
    });

    it("Retry waits until its due time", async () => {
      await committedTransition();
      clock.transport.fail = () => true;
      await scheduled.tick();
      expect(clock.transport.attempts).toHaveLength(1);

      clock.transport.fail = () => false;
      clock.setNow(new Date(minutesAfter(NOW, 5).getTime() - 1000).toISOString()); // 4:59 later
      await scheduled.tick();
      await runEmailCycle();
      expect(clock.transport.attempts).toHaveLength(1);

      clock.setNow(minutesAfter(NOW, 5).toISOString());
      await scheduled.tick();
      expect(clock.transport.attempts).toHaveLength(2);
      expect((await emailRows())[0]).toMatchObject({ deliveryState: "sent", attemptCount: 2 });
    });

    it("Three failed submissions stop automatic retries", async () => {
      await committedTransition();
      clock.transport.fail = () => true;
      const outcomes = [];
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        outcomes.push(await scheduled.tick());
        clock.advanceMinutes(5);
      }
      expect(outcomes.map((c) => [c.retryScheduled, c.failed])).toEqual([[1, 0], [1, 0], [0, 1]]);
      const [job] = await emailRows();
      expect(job).toMatchObject({ deliveryState: "failed", attemptCount: 3, nextAttemptAt: null, sentAt: null });

      clock.transport.fail = () => false;
      for (const minutes of [5, 60, 24 * 60]) {
        clock.advanceMinutes(minutes);
        await scheduled.tick();
      }
      expect(clock.transport.attempts).toHaveLength(3);
      expect((await emailRows())[0]).toEqual(job);
    });

    it("Pending delivery survives a process restart", async () => {
      // Saved by the earlier process; that process stopped before dispatching it.
      const { job } = await committedTransition();
      const restarted = registerOnStubCron();
      clock.advanceMinutes(30);
      expect(await restarted.tick()).toMatchObject({ sent: 1, queued: 0 });
      const rows = await emailRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: job.id, deliveryState: "sent", attemptCount: 1 });
      expect(clock.transport.sent.map((m) => m.text)).toEqual([job.body]);

      // The process stopped after claiming the final attempt but before recording its outcome:
      // the job must not stay pending forever, and no fourth submission is made.
      const interrupted = await committedTransition({ departureDate: "2026-12-09", returnDate: "2026-12-09" });
      await db.reservationEmail.update(
        { attemptCount: 3, nextAttemptAt: minutesAfter(clock.now.toISOString(), 5) },
        { where: { id: interrupted.job.id } }
      );
      clock.advanceMinutes(5);
      const attemptsBefore = clock.transport.attempts.length;
      expect(await registerOnStubCron().tick()).toMatchObject({ sent: 0, failed: 1 });
      expect(clock.transport.attempts).toHaveLength(attemptsBefore);
      expect((await emailRows({ id: interrupted.job.id }))[0]).toMatchObject({ deliveryState: "failed", attemptCount: 3, nextAttemptAt: null });
    });

    it("Concurrent dispatchers serialize a notification attempt", async () => {
      await committedTransition();
      const results = await Promise.all([scheduled.tick(), runEmailCycle(), runEmailCycle()]);
      expect(results.reduce((sum, counts) => sum + counts.sent, 0)).toBe(1);
      expect(clock.transport.attempts).toHaveLength(1);
      expect((await emailRows())[0]).toMatchObject({ deliveryState: "sent", attemptCount: 1 });

      // A submission ends well before its claim expires, so a slow provider cannot let a second
      // dispatcher claim and resubmit the job while the first submission is still in flight.
      expect(SEND_TIMEOUT_MS).toBeLessThan(RETRY_DELAY_MS);
      const smtp = realCreateTransport({ host: "smtp.test.invalid", port: 587, secure: false, user: null, password: null });
      const options = smtp.transporter.options;
      smtp.close();
      for (const key of ["connectionTimeout", "greetingTimeout", "socketTimeout"]) {
        expect(options[key]).toBeGreaterThan(0);
        expect(options[key]).toBeLessThan(RETRY_DELAY_MS);
      }
      const { job: hung } = await committedTransition({ departureDate: "2026-12-09", returnDate: "2026-12-09" });
      clock.transport.sendMail = () => new Promise(() => {});
      emailRuntime.sendTimeoutMs = 50;
      try {
        expect(await scheduled.tick()).toMatchObject({ sent: 0, retryScheduled: 1 });
      } finally {
        delete emailRuntime.sendTimeoutMs;
      }
      expect((await emailRows({ id: hung.id }))[0]).toMatchObject({ deliveryState: "pending", attemptCount: 1 });
    });

    it("Missing email configuration preserves pending jobs", async () => {
      clock.setNow("2026-11-30T15:00:00.000Z"); // 09:00 local: a reminder would otherwise be prepared
      await makeRequest(seed, { status: "reserved", vehicleId: seed.vehicle.id });
      await committedTransition({ departureDate: "2026-12-09", returnDate: "2026-12-09" });
      const before = await emailRows();
      const logs = captureLogs(logger);

      for (const broken of [{ SMTP_HOST: undefined }, { SMTP_PORT: "smtp" }, { SMTP_FROM: "not-an-address" }, { SMTP_SECURE: "yes" }, { SMTP_USER: "fleet@oc.edu", SMTP_PASSWORD: "" }]) {
        const saved = Object.fromEntries(Object.keys(broken).map((key) => [key, process.env[key]]));
        for (const [key, value] of Object.entries(broken)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
        await expect(scheduled.tick()).resolves.toBeNull();
        Object.assign(process.env, saved);
      }
      expect(logs.filter((l) => l.message === "EMAIL_CONFIGURATION_INVALID")).toHaveLength(5);
      expect(clock.transportsCreated).toBe(0);
      expect(await emailRows()).toEqual(before);
      expect((await authMe(admin.token)).status).toBe(200);

      // Corrected configuration: the next tick runs normally.
      expect(await scheduled.tick()).toMatchObject({ queued: 1, sent: 2 });
    });

    it("Email logs omit recipients bodies and secrets", async () => {
      process.env.SMTP_USER = "fleet-sender@oc.edu";
      process.env.SMTP_PASSWORD = "app-password-123";
      const failing = await committedTransition();
      const passing = await committedTransition({ departureDate: "2026-12-09", returnDate: "2026-12-09", purpose: "Private purpose text" });
      clock.transport.sendMail = async (message) => {
        clock.transport.attempts.push(message);
        if (message.text === failing.job.body) {
          throw new Error(`535 auth failed for ${process.env.SMTP_USER}:${process.env.SMTP_PASSWORD} sending to ${message.to}`);
        }
        clock.transport.sent.push(message);
        return { accepted: [message.to] };
      };
      const logs = captureLogs(logger);
      clock.advanceMinutes(1);
      await scheduled.tick();
      clock.transport.attempts.length = 0;

      const text = logs.map((l) => l.message).join("\n");
      expect(text).toContain(`EMAIL_SENT id=${passing.job.id}`);
      expect(text).toContain(`EMAIL_RETRY_SCHEDULED id=${failing.job.id}`);
      expect(text).toMatch(/EMAIL_RUN_COMPLETED queued=0 sent=1 retryScheduled=1 failed=0 skipped=0/);
      for (const secret of [seed.requestor.email, "fleet-sender@oc.edu", "app-password-123", "535 auth failed", "Private purpose text", "Status changed", passing.job.subject]) {
        expect(text).not.toContain(secret);
      }
      expect(text).not.toMatch(/@/);
      expect(logs.every((l) => /^EMAIL_[A-Z_]+( |$)/.test(l.message))).toBe(true);
    });

    it("One delivery failure does not stop other due notifications", async () => {
      const first = await committedTransition();
      const second = await committedTransition({ departureDate: "2026-12-09", returnDate: "2026-12-09" });
      clock.transport.fail = (message) => message.text === first.job.body;
      expect(await scheduled.tick()).toMatchObject({ sent: 1, retryScheduled: 1 });
      expect(clock.transport.attempts.map((m) => m.text)).toEqual([first.job.body, second.job.body]);
      const [firstJob, secondJob] = await emailRows();
      expect(firstJob).toMatchObject({ deliveryState: "pending", attemptCount: 1 });
      expect(secondJob).toMatchObject({ deliveryState: "sent", attemptCount: 1 });

      // A job on its last attempt is marked failed, and the next job is still sent.
      await db.reservationEmail.update({ attemptCount: 2 }, { where: { id: firstJob.id } });
      const third = await committedTransition({ departureDate: "2026-12-10", returnDate: "2026-12-10" });
      clock.advanceMinutes(5);
      expect(await scheduled.tick()).toMatchObject({ sent: 1, failed: 1 });
      expect((await emailRows({ id: firstJob.id }))[0]).toMatchObject({ deliveryState: "failed", attemptCount: 3 });
      expect((await emailRows({ id: third.job.id }))[0]).toMatchObject({ deliveryState: "sent" });
    });

    it("Backend registers its in-process email schedule", async () => {
      expect(scheduled.cron.schedule).toHaveBeenCalledTimes(1);
      const [expression, callback, options] = scheduled.cron.schedule.mock.calls[0];
      expect(expression).toBe("* * * * *");
      expect(options).toEqual({ timezone: "America/Chicago" });
      expect(typeof callback).toBe("function");

      // 03:00 America/Chicago: outside the reminder window, status dispatch and retries still run.
      clock.setNow("2026-11-30T09:00:00.000Z");
      await makeRequest(seed, { status: "reserved", vehicleId: seed.vehicle.id }); // departs tomorrow
      const { job } = await committedTransition({ departureDate: "2026-12-09", returnDate: "2026-12-09" });
      await db.reservationEmail.update({ attemptCount: 1 }, { where: { id: job.id } }); // a due retry
      expect(await callback()).toEqual({ queued: 0, sent: 1, retryScheduled: 0, failed: 0, skipped: 0 });
      expect((await emailRows())[0]).toMatchObject({ id: job.id, deliveryState: "sent", attemptCount: 2 });

      // The same cycle as Send now: at 09:00 both prepare the same reminder exactly once.
      clock.setNow("2026-11-30T15:00:00.000Z");
      const response = await sendNow(admin.token);
      expect(response.body).toMatchObject({ queued: 1, sent: 1 });
      expect(await callback()).toEqual({ queued: 0, sent: 0, retryScheduled: 0, failed: 0, skipped: 0 });
    });

    it("Unexpected scheduled failure keeps the server available", async () => {
      const { job } = await committedTransition();
      const logs = captureLogs(logger);
      jest
        .spyOn(db.reservationEmail, "findAll")
        .mockRejectedValueOnce(new Error(`ER_LOCK_WAIT for ${seed.requestor.email}: ${job.body}`));
      await expect(scheduled.tick()).resolves.toBeNull();
      expect(logs.map((l) => l.message)).toEqual(["EMAIL_RUN_FAILED"]);
      expect(logs[0].level).toBe("error");
      expect((await authMe(admin.token)).status).toBe(200);

      // The next scheduled callback runs normally.
      expect(await scheduled.tick()).toMatchObject({ sent: 1 });
      expect((await emailRows())[0]).toMatchObject({ deliveryState: "sent" });
    });
  });
});
