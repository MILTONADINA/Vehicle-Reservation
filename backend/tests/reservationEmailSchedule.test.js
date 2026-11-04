/**
 * Feature 9 — Reservation Emails: day-before pickup reminders (US-9.2).
 * Spec: features/feature-9-reservation-emails.md
 * Each "scheduled job run" invokes the callback registered on a stub node-cron with a fixed clock.
 */
import db from "../app/models/index.js";
import { runEmailCycle } from "../app/reservationEmails/emailCycle.js";
import { syncTestDatabase, signInAs } from "./helpers.js";
import {
  installEmailRuntime,
  restoreEmailRuntime,
  registerOnStubCron,
  seedTrip,
  makeRequest,
  makeArea,
  makeVehicle,
  changeStatus,
  emailRows,
} from "./emailFixtures.js";

// 09:00 America/Chicago on 2026-11-30 (CST), the day before a 2026-12-01 departure.
const NINE_AM = "2026-11-30T15:00:00.000Z";

let clock, seed, scheduled;

const reserved = (overrides = {}) => makeRequest(seed, { status: "reserved", vehicleId: seed.vehicle.id, ...overrides });
const reminders = (where = {}) => emailRows({ kind: "pickup_reminder", ...where });

const expectedReminderBody = ({ req, area, vehicle, departure, ret }) =>
  [
    area.noticeEmail,
    "",
    `Reservation: #${req.id}`,
    `Area: ${area.areaName}`,
    `Departure: ${departure} (America/Chicago)`,
    `Return: ${ret} (America/Chicago)`,
    `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}, ${vehicle.color}, plate ${vehicle.plateNumber}`,
    `Pickup parking: ${vehicle.designatedParking}`,
    `Passengers: ${req.passengers}`,
    `Purpose: ${req.purpose}`,
  ].join("\n");

beforeAll(async () => {
  await syncTestDatabase();
});

beforeEach(async () => {
  await syncTestDatabase();
  clock = installEmailRuntime(NINE_AM);
  seed = await seedTrip();
  scheduled = registerOnStubCron();
});

afterEach(() => {
  restoreEmailRuntime();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe("Feature 9 — Reservation Emails", () => {
  describe("US-9.2 — Receive day-before pickup instructions", () => {
    it("Timed trip receives a day-before pickup reminder", async () => {
      const req = await reserved({ departureTime: "07:45", returnDate: "2026-12-02", returnTime: "18:30" });
      const counts = await scheduled.tick();
      expect(counts).toEqual({ queued: 1, sent: 1, retryScheduled: 0, failed: 0, skipped: 0 });

      const [job] = await reminders();
      const body = expectedReminderBody({
        req, area: seed.area, vehicle: seed.vehicle, departure: "2026-12-01 07:45", ret: "2026-12-02 18:30",
      });
      expect(job).toMatchObject({
        reservationRequestId: req.id,
        notificationKey: "2026-12-01",
        recipient: seed.requestor.email,
        subject: `Reservation #${req.id} — vehicle pickup reminder`,
        body,
        deliveryState: "sent",
        attemptCount: 1,
      });
      expect(clock.transport.sent).toEqual([
        { from: "vehicles@oc.edu", to: seed.requestor.email, subject: `Reservation #${req.id} — vehicle pickup reminder`, text: body },
      ]);
    });

    it("Whole-day trip reminder does not invent a departure time", async () => {
      clock.setNow("2026-11-30T19:30:00.000Z"); // 13:30 local, after 09:00
      const req = await reserved({ departureTime: null, returnDate: "2026-12-02", returnTime: null });
      await scheduled.tick();
      const [job] = await reminders();
      expect(job.body).toBe(
        expectedReminderBody({ req, area: seed.area, vehicle: seed.vehicle, departure: "2026-12-01 Whole day", ret: "2026-12-02 Whole day" })
      );
      expect(job.body).not.toMatch(/00:00|12:00 AM|23:59/);
    });

    it("Reminder is not prepared before the daily start time", async () => {
      clock.setNow("2026-11-30T14:59:00.000Z"); // 08:59 America/Chicago
      await reserved();
      const counts = await scheduled.tick();
      expect(counts.queued).toBe(0);
      expect(await reminders()).toEqual([]);
      expect(clock.transport.attempts).toEqual([]);

      clock.setNow(NINE_AM);
      expect((await scheduled.tick()).queued).toBe(1);
    });

    it("Reminder date uses the campus calendar instead of the UTC date", async () => {
      clock.setNow("2026-10-30T01:00:00.000Z"); // 20:00 on October 29 in America/Chicago
      const oct30 = await reserved({ departureDate: "2026-10-30", returnDate: "2026-10-30" });
      await reserved({ departureDate: "2026-10-31", returnDate: "2026-10-31" });
      await scheduled.tick();
      expect((await reminders()).map((job) => [job.reservationRequestId, job.notificationKey])).toEqual([[oct30.id, "2026-10-30"]]);
    });

    it("Daylight saving changes do not shift the reminder day", async () => {
      // Fall back: 09:00 CDT on 2026-10-31; the next local date 2026-11-01 is 25 hours long.
      clock.setNow("2026-10-31T14:00:00.000Z");
      const fallBack = await reserved({ departureDate: "2026-11-01", returnDate: "2026-11-01" });
      await reserved({ departureDate: "2026-11-02", returnDate: "2026-11-02" });
      await scheduled.tick();
      await scheduled.tick();
      expect((await reminders()).map((job) => job.reservationRequestId)).toEqual([fallBack.id]);

      // Spring forward: 09:00 CST on 2027-03-13; the next local date 2027-03-14 is 23 hours long.
      clock.setNow("2027-03-13T15:00:00.000Z");
      const springForward = await reserved({ departureDate: "2027-03-14", returnDate: "2027-03-14" });
      await reserved({ departureDate: "2027-03-15", returnDate: "2027-03-15" });
      await scheduled.tick();
      await scheduled.tick();
      expect((await reminders()).map((job) => job.reservationRequestId)).toEqual([fallBack.id, springForward.id]);

      // 08:59 local just before each window still selects nothing new.
      clock.setNow("2027-03-14T13:59:00.000Z"); // 08:59 CDT on 2027-03-14
      await reserved({ departureDate: "2027-03-15", returnDate: "2027-03-15", purpose: "Second" });
      await scheduled.tick();
      expect(await reminders()).toHaveLength(2);
    });

    it("Only Reserved trips receive pickup reminders", async () => {
      await makeRequest(seed, { status: "requested" });
      await makeRequest(seed, { status: "awaiting_vehicle" });
      const onlyReserved = await reserved();
      await makeRequest(seed, { status: "returned", vehicleId: seed.vehicle.id });
      await makeRequest(seed, { status: "cancelled" });
      await scheduled.tick();
      expect((await reminders()).map((job) => job.reservationRequestId)).toEqual([onlyReserved.id]);
    });

    it("Trips outside tomorrow are not selected", async () => {
      for (const date of ["2026-11-29", "2026-11-30", "2026-12-02", "2026-12-15"]) {
        await reserved({ departureDate: date, returnDate: "2026-12-20" });
      }
      const counts = await scheduled.tick();
      expect(counts.queued).toBe(0);
      expect(await reminders()).toEqual([]);
    });

    it("Reminder uses the request area rather than a user assignment", async () => {
      const area2 = await makeArea({ noticeEmail: "Area two: collect keys from the music office." });
      const vehicle2 = await makeVehicle(area2.id, { designatedParking: "Music lot" });
      expect(seed.requestor.areaId).toBeNull();
      const req = await makeRequest(seed, { areaId: area2.id, status: "reserved", vehicleId: vehicle2.id });
      await scheduled.tick();
      const [job] = await reminders();
      expect(job.recipient).toBe(seed.requestor.email);
      expect(job.body.startsWith("Area two: collect keys from the music office.\n\n")).toBe(true);
      expect(job.body).toContain(`Area: ${area2.areaName}`);
      expect(job.body).not.toContain(seed.area.noticeEmail);
      expect(job.body).toContain("Pickup parking: Music lot");
      expect(job.reservationRequestId).toBe(req.id);
    });

    it("Saved reminder instructions are preserved as plain text", async () => {
      const notice = "Pick Up KEYS at  Room 12B.\nQuestions: Fleet@OC.edu\n<b>Return</b> it clean &amp; fueled <script>x</script>";
      await seed.area.update({ noticeEmail: notice });
      const req = await reserved();
      await scheduled.tick();
      const [job] = await reminders();
      expect(job.body.startsWith(`${notice}\n\nReservation: #${req.id}\n`)).toBe(true);
      expect(job.subject).toBe(`Reservation #${req.id} — vehicle pickup reminder`);
      expect(job.recipient).toBe(seed.requestor.email);
      const [message] = clock.transport.sent;
      expect(Object.keys(message).sort()).toEqual(["from", "subject", "text", "to"]);
      expect(message.to).toBe(seed.requestor.email);
      expect(message.from).toBe("vehicles@oc.edu");
      expect(message.text).toContain("Fleet@OC.edu\n<b>Return</b> it clean &amp; fueled <script>x</script>");
    });

    it("Reminder snapshots the current area and vehicle data when queued", async () => {
      const req = await reserved();
      // Edited after booking, before the reminder is prepared.
      await seed.area.update({ noticeEmail: "Updated: keys are in the lockbox." });
      await seed.vehicle.update({ designatedParking: "Lot C, space 9" });
      clock.transport.fail = () => true;
      await scheduled.tick();
      const [queued] = await reminders();
      expect(queued.body.startsWith("Updated: keys are in the lockbox.\n\n")).toBe(true);
      expect(queued.body).toContain("Pickup parking: Lot C, space 9");

      // Later edits do not rewrite the saved message or add another job.
      await seed.area.update({ noticeEmail: "Changed again." });
      await seed.vehicle.update({ designatedParking: "Lot D" });
      clock.transport.fail = () => false;
      clock.advanceMinutes(5);
      await scheduled.tick();
      const jobs = await reminders();
      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({ deliveryState: "sent", attemptCount: 2, body: queued.body, subject: queued.subject });
      expect(clock.transport.sent.map((m) => m.text)).toEqual([queued.body]);
      expect(jobs[0].reservationRequestId).toBe(req.id);
    });

    it("Late reservation or scheduler restart catches up on the day before", async () => {
      // Reserved at 17:30 local, after the 09:00 start; nothing ran earlier that day.
      clock.setNow("2026-11-30T23:30:00.000Z");
      const admin = await signInAs("admin");
      const req = await makeRequest(seed);
      expect((await changeStatus(admin.token, req.id, { status: "reserved", vehicleId: seed.vehicle.id })).status).toBe(200);

      // A restarted backend registers a fresh schedule against the same database.
      const restarted = registerOnStubCron();
      expect((await restarted.tick()).queued).toBe(1);
      clock.advanceMinutes(1);
      expect((await restarted.tick()).queued).toBe(0);
      const jobs = await reminders();
      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({ reservationRequestId: req.id, deliveryState: "sent" });
    });

    it("Repeated and concurrent reminder scans do not duplicate jobs", async () => {
      const req = await reserved();
      clock.transport.fail = () => true;
      const results = await Promise.all([scheduled.tick(), runEmailCycle(), runEmailCycle()]);
      expect(results.reduce((sum, counts) => sum + counts.queued, 0)).toBe(1);
      await scheduled.tick();
      await runEmailCycle();
      const jobs = await reminders();
      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({ reservationRequestId: req.id, notificationKey: "2026-12-01", attemptCount: 1 });
      expect(clock.transport.attempts).toHaveLength(1);
    });

    it("Cancellation before the reminder claim prevents delivery", async () => {
      const req = await reserved();
      clock.transport.fail = () => true;
      await scheduled.tick(); // reminder prepared; its first submission fails
      const [pending] = await reminders();
      expect(pending).toMatchObject({ deliveryState: "pending", attemptCount: 1 });

      const admin = await signInAs("admin");
      expect((await changeStatus(admin.token, req.id, { status: "cancelled" })).status).toBe(200);

      clock.transport.fail = () => false;
      clock.advanceMinutes(5);
      const counts = await scheduled.tick();
      expect(counts).toMatchObject({ skipped: 1, sent: 1 });
      const [reminder] = await reminders();
      expect(reminder).toMatchObject({ deliveryState: "skipped", attemptCount: 1, nextAttemptAt: null });
      expect(clock.transport.sent.map((m) => m.subject)).toEqual([`Reservation #${req.id} — Cancelled`]);
    });

    it("Reminder retries stop when the trip is no longer eligible", async () => {
      const admin = await signInAs("admin");
      const returned = await reserved({ purpose: "Returned trip" });
      const cancelled = await reserved({ purpose: "Cancelled trip" });
      clock.transport.fail = () => true;
      await scheduled.tick();
      expect(await reminders({ deliveryState: "pending" })).toHaveLength(2);

      await changeStatus(admin.token, returned.id, { status: "returned" });
      await changeStatus(admin.token, cancelled.id, { status: "cancelled" });
      clock.advanceMinutes(5);
      const reminderAttempts = () => clock.transport.attempts.filter((m) => m.subject.endsWith("pickup reminder")).length;
      await scheduled.tick();
      expect(reminderAttempts()).toBe(2);
      expect((await reminders()).map((job) => job.deliveryState)).toEqual(["skipped", "skipped"]);

      // The window ends at local midnight: a still-reserved trip's retry due after midnight is skipped.
      const late = await reserved({ departureDate: "2026-12-03", returnDate: "2026-12-03" });
      clock.setNow("2026-12-03T05:58:00.000Z"); // 23:58 on 2026-12-02 local
      await scheduled.tick();
      const [lateJob] = await reminders({ reservationRequestId: late.id });
      expect(lateJob).toMatchObject({ deliveryState: "pending", attemptCount: 1 });
      clock.advanceMinutes(5); // 00:03 on the departure day
      const before = reminderAttempts();
      await scheduled.tick();
      expect(reminderAttempts()).toBe(before);
      expect((await reminders({ reservationRequestId: late.id }))[0]).toMatchObject({ deliveryState: "skipped", attemptCount: 1 });
    });
  });
});
