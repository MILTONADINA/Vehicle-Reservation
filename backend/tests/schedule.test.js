/**
 * Feature 11 — Weekly Vehicle Schedule
 * Spec: features/feature-11-weekly-vehicle-schedule.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { syncTestDatabase, signInAs } from "./helpers.js";

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const getSchedule = (token, query = {}) =>
  auth(request(app).get("/vehicle-t6/schedule").query(query), token);
const getQueue = (token, query = {}) =>
  auth(request(app).get("/vehicle-t6/service-queue").query(query), token);

const WEEK = "2026-11-02";
const WEEK_END = "2026-11-08";

let area1, area2, approvedDriver, destination;
let vehicleCounter = 0;

const makeArea = (overrides = {}) =>
  db.area.create({
    areaName: `Area ${Date.now()}${Math.random()}`,
    areaLogo: "https://example.com/logo.png",
    noticeEmail: "Return clean.",
    ...overrides,
  });

const makeDriver = (overrides = {}) =>
  db.driver.create({
    firstName: "Jane",
    lastName: "Doe",
    licenseState: "OK",
    licenseExpireDate: "2028-01-01",
    approvedDate: "2025-01-01",
    status: "approved",
    ...overrides,
  });

const makeDestination = (overrides = {}) =>
  db.destination.create({
    destinationName: `Dest ${Date.now()}${Math.random()}`,
    addressLine: "100 Main St",
    city: "Oklahoma City",
    state: "OK",
    zipCode: "73159",
    roundTripMiles: 120.5,
    status: "active",
    ...overrides,
  });

const makeVehicle = (overrides = {}) => {
  vehicleCounter += 1;
  return db.vehicle.create({
    make: "Ford",
    model: "Transit",
    year: 2024,
    vin: `VIN${String(vehicleCounter).padStart(14, "0")}`,
    purchasedDate: "2024-01-01",
    color: "White",
    passengers: 8,
    plateNumber: overrides.plateNumber || `PLT${String(vehicleCounter).padStart(7, "0")}`,
    plateExpireMonth: 6,
    designatedParking: "Lot A",
    areaId: area1.id,
    ...overrides,
  });
};

const makeRequest = (overrides = {}) =>
  db.reservationRequest.create({
    requestorUserId: overrides.requestorUserId || 1,
    areaId: overrides.areaId || area1.id,
    driverId: overrides.driverId || approvedDriver.id,
    destinationId: overrides.destinationId || destination.id,
    destinationCity: null,
    estimatedMiles: null,
    departureDate: "2026-11-03",
    departureTime: "09:00",
    returnDate: "2026-11-05",
    returnTime: "17:00",
    passengers: 4,
    purpose: "Trip purpose",
    noteType: null,
    noteText: null,
    vehicleId: null,
    statusReason: null,
    status: "reserved",
    ...overrides,
  });

beforeEach(async () => {
  vehicleCounter = 0;
  await syncTestDatabase();
  area1 = await makeArea({ areaName: "Area 1" });
  area2 = await makeArea({ areaName: "Area 2" });
  approvedDriver = await makeDriver();
  destination = await makeDestination();
});
afterAll(async () => {
  await db.sequelize.close();
});

describe("Feature 11 — Weekly Vehicle Schedule", () => {
  describe("US-11.1 — View the weekly schedule", () => {
    it("Admin lists schedule items for the week", async () => {
      const { user: requestor } = await signInAs("requestor", { firstName: "Avery", lastName: "Reed" });
      const { token } = await signInAs("admin");
      const reserved = await makeRequest({
        requestorUserId: requestor.id,
        status: "reserved",
        departureDate: "2026-11-03",
        departureTime: "09:00",
        returnDate: "2026-11-05",
        returnTime: "17:00",
      });
      const awaiting = await makeRequest({
        requestorUserId: requestor.id,
        status: "awaiting_vehicle",
        departureDate: "2026-11-04",
        departureTime: null,
        returnDate: "2026-11-04",
        returnTime: null,
      });
      const laterSameDay = await makeRequest({
        requestorUserId: requestor.id,
        status: "requested",
        departureDate: "2026-11-03",
        departureTime: "14:00",
        returnDate: "2026-11-03",
        returnTime: "18:00",
      });

      const response = await getSchedule(token, { weekStart: WEEK });
      expect(response.status).toBe(200);
      expect(response.body.weekStart).toBe(WEEK);
      expect(response.body.weekEnd).toBe(WEEK_END);
      expect(response.body.items.map((row) => row.id)).toEqual([reserved.id, laterSameDay.id, awaiting.id]);
      expect(response.body.items[0].requestorName).toBe("Avery Reed");
    });

    it("Area admin lists only its area on the schedule", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("area_admin", { areaId: area2.id });
      await makeRequest({ requestorUserId: requestor.id, areaId: area1.id });
      const own = await makeRequest({ requestorUserId: requestor.id, areaId: area2.id });

      const response = await getSchedule(token, { weekStart: WEEK });
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].id).toBe(own.id);
      expect(response.body.items[0].areaId).toBe(area2.id);
    });

    it("Area admin without an assignment gets an empty schedule", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("area_admin", { areaId: null });
      await makeRequest({ requestorUserId: requestor.id });

      const response = await getSchedule(token, { weekStart: WEEK });
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    });

    it("Request spanning the week start is included", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("admin");
      const spanning = await makeRequest({
        requestorUserId: requestor.id,
        departureDate: "2026-10-30",
        departureTime: "08:00",
        returnDate: "2026-11-04",
        returnTime: "12:00",
      });

      const response = await getSchedule(token, { weekStart: WEEK });
      expect(response.status).toBe(200);
      expect(response.body.items.map((row) => row.id)).toContain(spanning.id);
    });

    it("Cancelled requests stay off the schedule", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("admin");
      await makeRequest({ requestorUserId: requestor.id, status: "cancelled" });
      const kept = await makeRequest({ requestorUserId: requestor.id, status: "reserved" });

      const response = await getSchedule(token, { weekStart: WEEK });
      expect(response.status).toBe(200);
      expect(response.body.items.map((row) => row.id)).toEqual([kept.id]);
    });

    it("Empty week returns an empty schedule", async () => {
      const { token } = await signInAs("admin");
      const response = await getSchedule(token, { weekStart: WEEK });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ weekStart: WEEK, weekEnd: WEEK_END, items: [] });
    });

    it("Assigned vehicle label is included", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("admin");
      const vehicle = await makeVehicle({ make: "Ford", model: "Transit", plateNumber: "OC-4521" });
      const reserved = await makeRequest({
        requestorUserId: requestor.id,
        status: "reserved",
        vehicleId: vehicle.id,
      });

      const response = await getSchedule(token, { weekStart: WEEK });
      expect(response.status).toBe(200);
      const item = response.body.items.find((row) => row.id === reserved.id);
      expect(item.vehicleId).toBe(vehicle.id);
      expect(item.vehicleLabel).toContain("Ford Transit");
      expect(item.vehicleLabel).toContain("OC-4521");
    });
  });

  describe("US-11.2 — View the service queue", () => {
    it("Admin lists requests that need a vehicle", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("admin");
      const awaitingEarly = await makeRequest({
        requestorUserId: requestor.id,
        status: "awaiting_vehicle",
        departureDate: "2026-11-03",
        departureTime: null,
      });
      const awaitingLate = await makeRequest({
        requestorUserId: requestor.id,
        status: "awaiting_vehicle",
        departureDate: "2026-11-03",
        departureTime: "10:00",
      });
      await makeRequest({ requestorUserId: requestor.id, status: "reserved" });
      await makeRequest({ requestorUserId: requestor.id, status: "requested" });

      const response = await getQueue(token);
      expect(response.status).toBe(200);
      expect(response.body.needVehicle.map((row) => row.id)).toEqual([awaitingEarly.id, awaitingLate.id]);
    });

    it("Admin lists requests that need check-in", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("admin");
      const now = new Date();
      const pastDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2))
        .toISOString()
        .slice(0, 10);
      const futureDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 5))
        .toISOString()
        .slice(0, 10);
      const past = await makeRequest({
        requestorUserId: requestor.id,
        status: "reserved",
        departureDate: pastDate,
        departureTime: "08:00",
        returnDate: pastDate,
        returnTime: "17:00",
      });
      await makeRequest({
        requestorUserId: requestor.id,
        status: "reserved",
        departureDate: futureDate,
        departureTime: "08:00",
        returnDate: futureDate,
        returnTime: "17:00",
      });

      const response = await getQueue(token);
      expect(response.status).toBe(200);
      expect(response.body.needCheckIn.map((row) => row.id)).toEqual([past.id]);
    });

    it("Returned requested and cancelled requests stay off the queue", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("admin");
      await makeRequest({ requestorUserId: requestor.id, status: "returned" });
      await makeRequest({ requestorUserId: requestor.id, status: "requested" });
      await makeRequest({ requestorUserId: requestor.id, status: "cancelled" });

      const response = await getQueue(token);
      expect(response.status).toBe(200);
      expect(response.body.needVehicle).toEqual([]);
      expect(response.body.needCheckIn).toEqual([]);
    });

    it("Area admin queue is limited to its area", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("area_admin", { areaId: area2.id });
      await makeRequest({
        requestorUserId: requestor.id,
        areaId: area1.id,
        status: "awaiting_vehicle",
      });
      const own = await makeRequest({
        requestorUserId: requestor.id,
        areaId: area2.id,
        status: "awaiting_vehicle",
      });

      const response = await getQueue(token);
      expect(response.status).toBe(200);
      expect(response.body.needVehicle.map((row) => row.id)).toEqual([own.id]);
      expect(response.body.needCheckIn).toEqual([]);
    });

    it("Empty service queue arrays are returned", async () => {
      const { token } = await signInAs("admin");
      const response = await getQueue(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ needVehicle: [], needCheckIn: [] });
    });
  });

  describe("US-11.3 — Move between weeks on the schedule", () => {
    it("Default weekStart is the current Monday", async () => {
      jest.useFakeTimers({ advanceTimers: true });
      jest.setSystemTime(new Date("2026-11-04T15:00:00.000Z"));
      const { token } = await signInAs("admin");
      const response = await getSchedule(token);
      jest.useRealTimers();
      expect(response.status).toBe(200);
      expect(response.body.weekStart).toBe(WEEK);
      expect(response.body.weekEnd).toBe(WEEK_END);
    });

    it("Non-Monday weekStart is rejected", async () => {
      const { token } = await signInAs("admin");
      const response = await getSchedule(token, { weekStart: "2026-11-03" });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid schedule data." });
    });

    it("Admin may filter schedule by area", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("admin");
      await makeRequest({ requestorUserId: requestor.id, areaId: area1.id });
      const area2Req = await makeRequest({ requestorUserId: requestor.id, areaId: area2.id });

      const response = await getSchedule(token, { weekStart: WEEK, areaId: area2.id });
      expect(response.status).toBe(200);
      expect(response.body.items.map((row) => row.id)).toEqual([area2Req.id]);
    });

    it("Unknown admin area filter is rejected", async () => {
      const { token } = await signInAs("admin");
      const response = await getSchedule(token, { weekStart: WEEK, areaId: 9999 });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Area with id=9999 not found." });
    });

    it("Area admin ignores a forged areaId query", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("area_admin", { areaId: area2.id });
      await makeRequest({ requestorUserId: requestor.id, areaId: area1.id });
      const own = await makeRequest({ requestorUserId: requestor.id, areaId: area2.id });

      const response = await getSchedule(token, { weekStart: WEEK, areaId: area1.id });
      expect(response.status).toBe(200);
      expect(response.body.items.map((row) => row.id)).toEqual([own.id]);
    });
  });

  describe("US-11.4 — Restrict schedule and queue access", () => {
    it("Schedule and queue APIs require a session", async () => {
      for (const pending of [getSchedule(), getQueue(), auth(request(app).get("/vehicle-t6/schedule"), "not-a-session")]) {
        const response = await pending;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
    });

    it("Requestor cannot open the schedule API", async () => {
      const { token } = await signInAs("requestor");
      const response = await getSchedule(token, { weekStart: WEEK });
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden." });
    });

    it("Maintenance cannot open the service queue API", async () => {
      const { token } = await signInAs("maintenance");
      const response = await getQueue(token);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden." });
    });
  });
});
