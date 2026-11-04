/**
 * Feature 9 — Reservation Emails: status-change jobs (US-9.1) and the admin Send now trigger (US-9.4).
 * Spec: features/feature-9-reservation-emails.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { syncTestDatabase, signInAs, createSession } from "./helpers.js";
import {
  installEmailRuntime,
  restoreEmailRuntime,
  seedTrip,
  makeRequest,
  makeArea,
  makeVehicle,
  changeStatus,
  cancelRequest,
  sendNow,
  authMe,
  emailRows,
} from "./emailFixtures.js";

const NOW = "2026-11-04T15:00:00.000Z";
const PAYLOAD_KEYS = [
  "id", "requestorUserId", "areaId", "driverId", "destinationId", "destinationCity", "estimatedMiles",
  "departureDate", "departureTime", "returnDate", "returnTime", "passengers", "purpose", "noteType",
  "noteText", "vehicleId", "statusReason", "status",
].sort();
const COUNT_KEYS = ["failed", "queued", "retryScheduled", "sent", "skipped"];

let clock, seed, admin, areaAdmin;

const vehicleText = (v) => `Vehicle: ${v.year} ${v.make} ${v.model}, ${v.color}, plate ${v.plateNumber}`;

const expectedStatusBody = ({ req, area, from, to, at = NOW, vehicle = null, reason = null }) =>
  [
    `Reservation: #${req.id}`,
    `Status changed: ${from} -> ${to}`,
    `Changed at: ${at}`,
    `Area: ${area.areaName}`,
    `Departure: ${req.departureDate} ${req.departureTime ?? "Whole day"} (America/Chicago)`,
    `Return: ${req.returnDate} ${req.returnTime ?? "Whole day"} (America/Chicago)`,
    vehicle ? vehicleText(vehicle) : "Vehicle: Not assigned",
    ...(reason ? [`Reason: ${reason}`] : []),
  ].join("\n");

/** The single committed status job for a request, checked against the shared contract. */
async function expectOneStatusJob(req, { to, from, label, vehicle = null }) {
  const jobs = await emailRows({ reservationRequestId: req.id });
  expect(jobs).toHaveLength(1);
  const [job] = jobs;
  expect(job).toMatchObject({
    kind: "status_change",
    notificationKey: to,
    recipient: seed.requestor.email,
    subject: `Reservation #${req.id} — ${label}`,
    deliveryState: "pending",
    attemptCount: 0,
    sentAt: null,
  });
  expect(job.nextAttemptAt.toISOString()).toBe(NOW);
  expect(job.body).toBe(expectedStatusBody({ req, area: seed.area, from, to: label, vehicle }));
  return job;
}

/** The existing 200 payload is unchanged and carries no email data; SMTP was not contacted. */
function expectPlainStatusResponse(response, status) {
  expect(response.status).toBe(200);
  expect(response.body.status).toBe(status);
  expect(Object.keys(response.body).sort()).toEqual(PAYLOAD_KEYS);
  const text = JSON.stringify(response.body);
  expect(text).not.toContain(seed.requestor.email);
  expect(text).not.toMatch(/deliveryState|recipient|subject|SMTP/i);
  expect(clock.transport.attempts).toHaveLength(0);
}

beforeAll(async () => {
  await syncTestDatabase();
});

beforeEach(async () => {
  await syncTestDatabase();
  clock = installEmailRuntime(NOW);
  seed = await seedTrip();
  admin = await signInAs("admin");
  areaAdmin = await signInAs("area_admin", { areaId: seed.area.id });
});

afterEach(() => {
  restoreEmailRuntime();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe("Feature 9 — Reservation Emails", () => {
  describe("US-9.1 — Receive reservation status emails", () => {
    it("Status email is prepared for requested to awaiting_vehicle", async () => {
      const req = await makeRequest(seed);
      const response = await changeStatus(areaAdmin.token, req.id, { status: "awaiting_vehicle" });
      expectPlainStatusResponse(response, "awaiting_vehicle");
      await expectOneStatusJob(req, { to: "awaiting_vehicle", from: "Requested", label: "Awaiting Vehicle" });
    });

    it("Status email is prepared for requested to reserved", async () => {
      const req = await makeRequest(seed);
      const response = await changeStatus(admin.token, req.id, { status: "reserved", vehicleId: seed.vehicle.id });
      expectPlainStatusResponse(response, "reserved");
      const job = await expectOneStatusJob(req, { to: "reserved", from: "Requested", label: "Reserved", vehicle: seed.vehicle });
      expect(job.body).toContain("Vehicle: 2024 Toyota Sienna, White, plate ");
      expect(job.body).toContain(seed.vehicle.plateNumber);
    });

    it("Status email is prepared for awaiting_vehicle to reserved", async () => {
      const req = await makeRequest(seed, { status: "awaiting_vehicle" });
      const response = await changeStatus(areaAdmin.token, req.id, { status: "reserved", vehicleId: seed.vehicle.id });
      expectPlainStatusResponse(response, "reserved");
      await expectOneStatusJob(req, { to: "reserved", from: "Awaiting Vehicle", label: "Reserved", vehicle: seed.vehicle });
    });

    it("Status email is prepared for reserved to returned", async () => {
      const req = await makeRequest(seed, { status: "reserved", vehicleId: seed.vehicle.id });
      const response = await changeStatus(admin.token, req.id, { status: "returned" });
      expectPlainStatusResponse(response, "returned");
      await expectOneStatusJob(req, { to: "returned", from: "Reserved", label: "Returned", vehicle: seed.vehicle });
    });

    it("Status email is prepared for requested to cancelled", async () => {
      const req = await makeRequest(seed);
      const response = await changeStatus(admin.token, req.id, { status: "cancelled" });
      expectPlainStatusResponse(response, "cancelled");
      await expectOneStatusJob(req, { to: "cancelled", from: "Requested", label: "Cancelled" });
    });

    it("Status email is prepared for awaiting_vehicle to cancelled", async () => {
      const req = await makeRequest(seed, { status: "awaiting_vehicle" });
      const response = await changeStatus(areaAdmin.token, req.id, { status: "cancelled" });
      expectPlainStatusResponse(response, "cancelled");
      await expectOneStatusJob(req, { to: "cancelled", from: "Awaiting Vehicle", label: "Cancelled" });
    });

    it("Status email is prepared for reserved to cancelled", async () => {
      const req = await makeRequest(seed, { status: "reserved", vehicleId: seed.vehicle.id });
      const response = await changeStatus(admin.token, req.id, { status: "cancelled" });
      expectPlainStatusResponse(response, "cancelled");
      // Feature 8 clears the vehicle on cancellation, so the committed state has no assigned vehicle.
      await expectOneStatusJob(req, { to: "cancelled", from: "Reserved", label: "Cancelled" });
    });

    it("Requestor cancellation prepares a status email", async () => {
      const req = await makeRequest(seed);
      const token = await createSession(seed.requestor);
      const response = await cancelRequest(token, req.id);
      expectPlainStatusResponse(response, "cancelled");
      await expectOneStatusJob(req, { to: "cancelled", from: "Requested", label: "Cancelled" });
    });

    it("Request creation and ordinary edits do not send status emails", async () => {
      const token = await createSession(seed.requestor);
      const body = {
        areaId: seed.area.id,
        driverId: seed.driver.id,
        destinationId: seed.destination.id,
        destinationCity: null,
        estimatedMiles: null,
        departureDate: "2026-12-01",
        departureTime: "08:30",
        returnDate: "2026-12-01",
        returnTime: "17:00",
        passengers: 4,
        purpose: "Conference shuttle",
        noteType: null,
        noteText: null,
      };
      const created = await request(app).post("/vehicle-t6/reservation-requests").set("Authorization", `Bearer ${token}`).send(body);
      expect(created.status).toBe(201);
      const edited = await request(app)
        .put(`/vehicle-t6/reservation-requests/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ ...body, purpose: "Updated purpose", passengers: 5 });
      expect(edited.status).toBe(200);
      expect(edited.body.status).toBe("requested");
      expect(await db.reservationEmail.count()).toBe(0);
    });

    it("Rejected status changes prepare no email", async () => {
      const otherArea = await makeArea();
      const otherVehicle = await makeVehicle(otherArea.id);
      const req = await makeRequest(seed);
      const reserved = await makeRequest(seed, { status: "reserved", vehicleId: seed.vehicle.id, departureDate: "2026-12-05", returnDate: "2026-12-05" });
      const outsider = await signInAs("area_admin", { areaId: otherArea.id });
      const requestorToken = await createSession(seed.requestor);
      const strangerToken = (await signInAs("requestor")).token;
      const before = async () => (await db.reservationRequest.findAll({ order: [["id", "ASC"]] })).map((r) => r.get({ plain: true }));
      const snapshot = await before();

      const attempts = [
        [await changeStatus(null, req.id, { status: "cancelled" }), 401, "Unauthorized."],
        [await changeStatus(requestorToken, req.id, { status: "cancelled" }), 403, "Forbidden."],
        [await changeStatus(outsider.token, req.id, { status: "cancelled" }), 404, `Reservation request with id=${req.id} not found.`],
        [await changeStatus(admin.token, req.id, { status: "approved" }), 400, "Invalid reservation request data."],
        [await changeStatus(admin.token, req.id, { status: "requested" }), 400, "Invalid reservation request data."],
        [await changeStatus(admin.token, reserved.id, { status: "reserved", vehicleId: seed.vehicle.id }), 400, "Invalid reservation request data."],
        // Rolled back inside the reserve transaction: the vehicle belongs to another area.
        [await changeStatus(admin.token, req.id, { status: "reserved", vehicleId: otherVehicle.id }), 400, "Invalid reservation request data."],
        [await cancelRequest(strangerToken, req.id), 404, `Reservation request with id=${req.id} not found.`],
        [await cancelRequest(requestorToken, reserved.id), 404, `Reservation request with id=${reserved.id} not found.`],
      ];
      for (const [response, status, message] of attempts) {
        expect(response.status).toBe(status);
        expect(response.body).toEqual({ message });
      }
      expect(await db.reservationEmail.count()).toBe(0);
      expect(await before()).toEqual(snapshot);
    });

    it("Email recipient cannot be overridden by request data", async () => {
      const req = await makeRequest(seed);
      const response = await changeStatus(admin.token, req.id, {
        status: "awaiting_vehicle",
        recipient: "attacker@example.com",
        email: "attacker@example.com",
        cc: "copy@example.com",
        bcc: "hidden@example.com",
      });
      expect(response.status).toBe(200);
      const [job] = await emailRows({ reservationRequestId: req.id });
      expect(job.recipient).toBe(seed.requestor.email);

      const run = await sendNow(admin.token);
      expect(run.body.sent).toBe(1);
      expect(clock.transport.sent).toEqual([
        { from: "vehicles@oc.edu", to: seed.requestor.email, subject: job.subject, text: job.body },
      ]);
    });

    it("Status emails retain the committed transition snapshot", async () => {
      const req = await makeRequest(seed);
      expect((await changeStatus(admin.token, req.id, { status: "reserved", vehicleId: seed.vehicle.id })).status).toBe(200);
      const reservedAt = clock.now.toISOString();
      clock.advanceMinutes(2);
      expect((await changeStatus(admin.token, req.id, { status: "cancelled", statusReason: "Trip called off" })).status).toBe(200);

      const run = await sendNow(admin.token);
      expect(run.body.sent).toBe(2);
      const [reservedMail, cancelledMail] = clock.transport.sent;
      expect(reservedMail.subject).toBe(`Reservation #${req.id} — Reserved`);
      expect(reservedMail.text).toBe(
        expectedStatusBody({ req, area: seed.area, from: "Requested", to: "Reserved", at: reservedAt, vehicle: seed.vehicle })
      );
      expect(reservedMail.text).not.toContain("Cancelled");
      expect(cancelledMail.subject).toBe(`Reservation #${req.id} — Cancelled`);
      expect(cancelledMail.text).toContain("Status changed: Reserved -> Cancelled");
      expect(await db.reservationEmail.count({ where: { reservationRequestId: req.id } })).toBe(2);
    });

    it("Cancellation reason is included only when provided", async () => {
      const withReason = await makeRequest(seed);
      const withoutReason = await makeRequest(seed);
      const reason = "Driver unavailable <b>today</b> & tomorrow";
      expect((await changeStatus(admin.token, withReason.id, { status: "cancelled", statusReason: reason })).status).toBe(200);
      expect((await changeStatus(admin.token, withoutReason.id, { status: "cancelled", statusReason: null })).status).toBe(200);

      const [first] = await emailRows({ reservationRequestId: withReason.id });
      const [second] = await emailRows({ reservationRequestId: withoutReason.id });
      expect(first.body).toBe(expectedStatusBody({ req: withReason, area: seed.area, from: "Requested", to: "Cancelled", reason }));
      expect(first.body.split("\n").at(-1)).toBe(`Reason: ${reason}`);
      expect(second.body).toBe(expectedStatusBody({ req: withoutReason, area: seed.area, from: "Requested", to: "Cancelled" }));
      expect(second.body).not.toContain("Reason:");
    });

    it("Email preparation failure rolls back the status change", async () => {
      const req = await makeRequest(seed);
      jest.spyOn(db.reservationEmail, "create").mockRejectedValueOnce(new Error("insert failed"));
      const response = await changeStatus(admin.token, req.id, { status: "reserved", vehicleId: seed.vehicle.id });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Reservation request failed." });
      const stored = await db.reservationRequest.findByPk(req.id);
      expect(stored.status).toBe("requested");
      expect(stored.vehicleId).toBeNull();
      expect(await db.reservationEmail.count()).toBe(0);
    });
  });

  describe("US-9.4 — Send due reservation emails now", () => {
    /** One due item of every kind: a reminder to prepare, a status job, a failing job, a last attempt, and a lost reminder. */
    async function seedEveryOutcome() {
      clock.setNow("2026-11-30T15:00:00.000Z"); // 09:00 America/Chicago, the day before 2026-12-01
      const due = clock.now;
      await makeRequest(seed, { status: "reserved", vehicleId: seed.vehicle.id });
      const base = { recipient: seed.requestor.email, subject: "s", body: "b", deliveryState: "pending", nextAttemptAt: due };
      const requestA = await makeRequest(seed, { status: "awaiting_vehicle", departureDate: "2026-12-10", returnDate: "2026-12-10" });
      const requestB = await makeRequest(seed, { status: "awaiting_vehicle", departureDate: "2026-12-11", returnDate: "2026-12-11" });
      const requestC = await makeRequest(seed, { status: "awaiting_vehicle", departureDate: "2026-12-12", returnDate: "2026-12-12" });
      const cancelled = await makeRequest(seed, { status: "cancelled", departureDate: "2026-12-01", returnDate: "2026-12-01" });
      await db.reservationEmail.bulkCreate([
        { ...base, reservationRequestId: requestA.id, kind: "status_change", notificationKey: "awaiting_vehicle", attemptCount: 0 },
        { ...base, reservationRequestId: requestB.id, kind: "status_change", notificationKey: "awaiting_vehicle", attemptCount: 0, recipient: "retry@oc.edu" },
        { ...base, reservationRequestId: requestC.id, kind: "status_change", notificationKey: "awaiting_vehicle", attemptCount: 2, recipient: "last@oc.edu" },
        { ...base, reservationRequestId: cancelled.id, kind: "pickup_reminder", notificationKey: "2026-12-01", attemptCount: 1 },
      ]);
      clock.transport.fail = (message) => message.to === "retry@oc.edu" || message.to === "last@oc.edu";
    }

    it("Admin triggers due emails with counts only", async () => {
      await seedEveryOutcome();
      const response = await sendNow(admin.token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ queued: 1, sent: 2, retryScheduled: 1, failed: 1, skipped: 1 });
      expect(Object.keys(response.body).sort()).toEqual(COUNT_KEYS);
      expect(JSON.stringify(response.body)).not.toMatch(/@|Reservation|subject|body|SMTP/i);
      expect(clock.transport.sent.map((m) => m.to)).toEqual([seed.requestor.email, seed.requestor.email]);

      // Nothing else is due: retries wait five minutes and terminal jobs stay terminal.
      const again = await sendNow(admin.token);
      expect(again.body).toEqual({ queued: 0, sent: 0, retryScheduled: 0, failed: 0, skipped: 0 });

      // The same reminder window applies: before 09:00 no reminder is prepared for the next day.
      const early = await makeRequest(seed, { status: "reserved", vehicleId: seed.vehicle.id, departureDate: "2026-12-02", returnDate: "2026-12-02" });
      clock.setNow("2026-12-01T14:30:00.000Z"); // 08:30 America/Chicago
      expect((await sendNow(admin.token)).body.queued).toBe(0);
      expect(await db.reservationEmail.count({ where: { reservationRequestId: early.id } })).toBe(0);
    });

    it("Trigger parameters cannot override the email run", async () => {
      const done = await makeRequest(seed, { status: "cancelled" });
      const waiting = await makeRequest(seed, { status: "awaiting_vehicle" });
      const due = await makeRequest(seed, { status: "returned", vehicleId: seed.vehicle.id });
      const base = { kind: "status_change", subject: "s", body: "b", recipient: seed.requestor.email };
      await db.reservationEmail.bulkCreate([
        { ...base, reservationRequestId: done.id, notificationKey: "cancelled", deliveryState: "failed", attemptCount: 3, nextAttemptAt: null },
        { ...base, reservationRequestId: waiting.id, notificationKey: "awaiting_vehicle", deliveryState: "pending", attemptCount: 1, nextAttemptAt: new Date(clock.now.getTime() + 3 * 60000) },
        { ...base, reservationRequestId: due.id, notificationKey: "returned", deliveryState: "pending", attemptCount: 0, nextAttemptAt: clock.now },
      ]);
      const overrides = {
        recipient: "attacker@example.com",
        email: "attacker@example.com",
        cc: "copy@example.com",
        bcc: "hidden@example.com",
        status: "pending",
        nextAttemptAt: "2000-01-01T00:00:00Z",
        attemptCount: "0",
      };
      const response = await sendNow(admin.token, { body: overrides, query: overrides });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ queued: 0, sent: 1, retryScheduled: 0, failed: 0, skipped: 0 });
      expect(clock.transport.attempts.map((m) => m.to)).toEqual([seed.requestor.email]);
      const [failedJob, waitingJob, dueJob] = await emailRows();
      expect(failedJob).toMatchObject({ deliveryState: "failed", attemptCount: 3, nextAttemptAt: null });
      expect(waitingJob).toMatchObject({ deliveryState: "pending", attemptCount: 1 });
      expect(dueJob).toMatchObject({ deliveryState: "sent", attemptCount: 1 });
    });

    it("Signed-out caller cannot trigger emails", async () => {
      const req = await makeRequest(seed);
      await changeStatus(admin.token, req.id, { status: "awaiting_vehicle" });
      const before = await emailRows();
      for (const token of [null, "not-a-session-token"]) {
        const response = await sendNow(token);
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
      expect(clock.transportsCreated).toBe(0);
      expect(await emailRows()).toEqual(before);
    });

    it("Non-admin roles cannot trigger emails", async () => {
      const req = await makeRequest(seed);
      await changeStatus(admin.token, req.id, { status: "awaiting_vehicle" });
      const before = await emailRows();
      for (const role of ["area_admin", "requestor", "maintenance"]) {
        const { token } = await signInAs(role, role === "area_admin" ? { areaId: seed.area.id } : {});
        const response = await sendNow(token);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(clock.transportsCreated).toBe(0);
      expect(clock.transport.attempts).toHaveLength(0);
      expect(await emailRows()).toEqual(before);
    });

    it("Fatal admin email run returns a safe error", async () => {
      const first = await makeRequest(seed, { status: "reserved", vehicleId: seed.vehicle.id });
      const second = await makeRequest(seed, { departureDate: "2026-12-09", returnDate: "2026-12-09" });
      await changeStatus(admin.token, first.id, { status: "returned" });
      await changeStatus(admin.token, second.id, { status: "awaiting_vehicle" });
      const pending = await emailRows();

      // Invalid SMTP configuration: nothing is claimed or changed.
      delete process.env.SMTP_HOST;
      const invalid = await sendNow(admin.token);
      expect(invalid.status).toBe(500);
      expect(invalid.body).toEqual({ message: "Emails could not be processed." });
      expect(await emailRows()).toEqual(pending);
      process.env.SMTP_HOST = "smtp.test.invalid";

      // Unexpected storage failure after the first job was sent and recorded.
      const findByPk = db.reservationEmail.findByPk.bind(db.reservationEmail);
      let lookups = 0;
      jest.spyOn(db.reservationEmail, "findByPk").mockImplementation((...args) => {
        lookups += 1;
        return lookups === 2 ? Promise.reject(new Error(`storage down for ${seed.requestor.email}`)) : findByPk(...args);
      });
      const failed = await sendNow(admin.token);
      expect(failed.status).toBe(500);
      expect(failed.body).toEqual({ message: "Emails could not be processed." });
      expect(JSON.stringify(failed.body)).not.toContain("@");
      jest.restoreAllMocks();

      const [firstJob] = await emailRows({ reservationRequestId: first.id });
      expect(firstJob).toMatchObject({ deliveryState: "sent", attemptCount: 1 });
      expect((await db.reservationRequest.findByPk(first.id)).status).toBe("returned");
      expect((await db.reservationRequest.findByPk(second.id)).status).toBe("awaiting_vehicle");
      expect((await authMe(admin.token)).status).toBe(200);
    });
  });
});
