/**
 * Feature 12 — Mileage & Service Logs
 * Spec: features/feature-12-mileage-service-logs.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { syncTestDatabase, signInAs, createUser } from "./helpers.js";

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const listVehicles = (token) => auth(request(app).get("/vehicle-t6/maintenance/vehicles"), token);
const listMileage = (token, vehicleId) =>
  auth(request(app).get(`/vehicle-t6/vehicles/${vehicleId}/mileage-logs`), token);
const createMileage = (token, vehicleId, body) =>
  auth(request(app).post(`/vehicle-t6/vehicles/${vehicleId}/mileage-logs`), token).send(body);
const listService = (token, vehicleId) =>
  auth(request(app).get(`/vehicle-t6/vehicles/${vehicleId}/service-logs`), token);
const createService = (token, vehicleId, body) =>
  auth(request(app).post(`/vehicle-t6/vehicles/${vehicleId}/service-logs`), token).send(body);
const deleteUser = (token, id) => auth(request(app).delete(`/vehicle-t6/users/${id}`), token);
const deleteVehicle = (token, id) => auth(request(app).delete(`/vehicle-t6/vehicles/${id}`), token);

let area1, area2;
let vehicleCounter = 0;

const makeArea = (overrides = {}) =>
  db.area.create({
    areaName: `Area ${Date.now()}${Math.random()}`,
    areaLogo: "https://example.com/logo.png",
    noticeEmail: "Return clean.",
    ...overrides,
  });

const makeVehicle = (overrides = {}) => {
  vehicleCounter += 1;
  return db.vehicle.create({
    make: overrides.make || "Toyota",
    model: overrides.model || "Sienna",
    year: 2024,
    vin: `VIN${String(vehicleCounter).padStart(14, "0")}`,
    purchasedDate: "2024-01-01",
    color: "White",
    passengers: 8,
    plateNumber: `PLT${String(vehicleCounter).padStart(7, "0")}`,
    plateExpireMonth: 6,
    designatedParking: "Lot A",
    areaId: overrides.areaId || area1.id,
    ...overrides,
  });
};

beforeEach(async () => {
  vehicleCounter = 0;
  await syncTestDatabase();
  area1 = await makeArea({ areaName: "Area 1" });
  area2 = await makeArea({ areaName: "Area 2" });
});
afterAll(async () => {
  await db.sequelize.close();
});

describe("Feature 12 — Mileage & Service Logs", () => {
  describe("US-12.1 — View vehicles for logging", () => {
    it("Maintenance lists every vehicle for logging", async () => {
      const ford = await makeVehicle({ make: "Ford", model: "Transit", areaId: area1.id });
      const chevy = await makeVehicle({ make: "Chevrolet", model: "Express", areaId: area2.id });
      const { token } = await signInAs("maintenance");

      const response = await listVehicles(token);
      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id)).toEqual([chevy.id, ford.id]);
      expect(response.body[0]).toEqual({
        id: chevy.id,
        make: "Chevrolet",
        model: "Express",
        year: 2024,
        plateNumber: chevy.plateNumber,
        color: "White",
        areaId: area2.id,
      });
    });

    it("Admin lists every vehicle for logging", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("admin");
      const response = await listVehicles(token);
      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id)).toEqual([vehicle.id]);
    });

    it("Empty maintenance vehicle list is returned", async () => {
      const { token } = await signInAs("maintenance");
      const response = await listVehicles(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Maintenance vehicles sort by make model then id", async () => {
      const fordEscape = await makeVehicle({ make: "Ford", model: "Escape" });
      const fordTransitB = await makeVehicle({ make: "Ford", model: "Transit" });
      const fordTransitA = await makeVehicle({ make: "Ford", model: "Transit" });
      const chevy = await makeVehicle({ make: "Chevrolet", model: "Express" });
      const { token } = await signInAs("maintenance");
      const response = await listVehicles(token);
      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id)).toEqual([
        chevy.id,
        fordEscape.id,
        fordTransitB.id,
        fordTransitA.id,
      ]);
    });
  });

  describe("US-12.2 — Log vehicle mileage", () => {
    it("Maintenance creates a mileage log", async () => {
      const vehicle = await makeVehicle();
      const { user, token } = await signInAs("maintenance");
      const response = await createMileage(token, vehicle.id, {
        logDate: "2026-10-28",
        mileage: 45210,
      });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        vehicleId: vehicle.id,
        logDate: "2026-10-28",
        mileage: 45210,
        loggedByUserId: user.id,
      });
      expect(Number.isInteger(response.body.id)).toBe(true);
      expect(response.body.createdAt).toBeTruthy();
    });

    it("First mileage log accepts any reading in range", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const response = await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 10 });
      expect(response.status).toBe(201);
      expect(response.body.mileage).toBe(10);
    });

    it("Mileage equal to the latest reading is allowed", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      await createMileage(token, vehicle.id, { logDate: "2026-10-27", mileage: 45210 });
      const response = await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 45210 });
      expect(response.status).toBe(201);
      expect(response.body.mileage).toBe(45210);
    });

    it("Mileage lower than the latest reading is rejected", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      await createMileage(token, vehicle.id, { logDate: "2026-10-27", mileage: 45210 });
      const before = await db.mileageLog.count();
      const response = await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 45000 });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Mileage cannot be lower than the latest reading." });
      expect(await db.mileageLog.count()).toBe(before);
    });

    it("Backdated mileage fits between neighboring readings", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      await createMileage(token, vehicle.id, { logDate: "2026-11-05", mileage: 50000 });
      const response = await createMileage(token, vehicle.id, { logDate: "2026-11-01", mileage: 49000 });
      expect(response.status).toBe(201);
      expect(response.body.mileage).toBe(49000);
    });

    it("Backdated mileage above the next reading is rejected", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      await createMileage(token, vehicle.id, { logDate: "2026-11-05", mileage: 50000 });
      const before = await db.mileageLog.count();
      const response = await createMileage(token, vehicle.id, { logDate: "2026-11-01", mileage: 51000 });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Mileage cannot be higher than the next reading." });
      expect(await db.mileageLog.count()).toBe(before);
    });

    it("Same-day mileage lower than an existing reading is rejected", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      await createMileage(token, vehicle.id, { logDate: "2026-11-03", mileage: 100 });
      const before = await db.mileageLog.count();
      const response = await createMileage(token, vehicle.id, { logDate: "2026-11-03", mileage: 50 });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Mileage cannot be lower than the latest reading." });
      expect(await db.mileageLog.count()).toBe(before);
    });

    it("Backdated mileage equal to the next reading is allowed", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      await createMileage(token, vehicle.id, { logDate: "2026-11-05", mileage: 50000 });
      const response = await createMileage(token, vehicle.id, { logDate: "2026-11-01", mileage: 50000 });
      expect(response.status).toBe(201);
      expect(response.body.mileage).toBe(50000);
    });

    it("Previous mileage neighbor uses logDate not id", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      await createMileage(token, vehicle.id, { logDate: "2026-11-05", mileage: 50000 });
      await createMileage(token, vehicle.id, { logDate: "2026-11-01", mileage: 40000 });
      const before = await db.mileageLog.count();
      // Dated after both logs; between their mileages. Previous by date is 50000, not the newer id 40000.
      const response = await createMileage(token, vehicle.id, { logDate: "2026-11-06", mileage: 45000 });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Mileage cannot be lower than the latest reading." });
      expect(await db.mileageLog.count()).toBe(before);
    });

    it("Next mileage neighbor is the earliest later reading", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      await createMileage(token, vehicle.id, { logDate: "2026-11-05", mileage: 40000 });
      await createMileage(token, vehicle.id, { logDate: "2026-11-10", mileage: 60000 });
      const before = await db.mileageLog.count();
      // Between the two later mileages; next must be the earliest later log (40000), not 60000.
      const response = await createMileage(token, vehicle.id, { logDate: "2026-11-01", mileage: 50000 });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Mileage cannot be higher than the next reading." });
      expect(await db.mileageLog.count()).toBe(before);
    });

    it("Latest mileage for ordering uses logDate then id", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      await createMileage(token, vehicle.id, { logDate: "2026-11-03", mileage: 100 });
      await createMileage(token, vehicle.id, { logDate: "2026-11-03", mileage: 200 });
      const before = await db.mileageLog.count();
      const response = await createMileage(token, vehicle.id, { logDate: "2026-11-04", mileage: 150 });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Mileage cannot be lower than the latest reading." });
      expect(await db.mileageLog.count()).toBe(before);
    });

    it("Mileage at the maximum is accepted", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const response = await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 2000000 });
      expect(response.status).toBe(201);
      expect(response.body.mileage).toBe(2000000);
    });

    it("Mileage above the maximum is rejected", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const response = await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 2000001 });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid mileage data." });
    });

    it("String mileage is rejected", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const response = await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: "100" });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid mileage data." });
    });

    it("Invalid mileage data is rejected", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      for (const body of [
        { mileage: 100 },
        { logDate: "2026-10-28", mileage: -1 },
        { logDate: "2026-10-28", mileage: 10.5 },
        { logDate: "2026-13-01", mileage: 100 },
      ]) {
        const response = await createMileage(token, vehicle.id, body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid mileage data." });
      }
      expect(await db.mileageLog.count()).toBe(0);
    });

    it("Client cannot choose the logger", async () => {
      const vehicle = await makeVehicle();
      const { user, token } = await signInAs("maintenance");
      const other = await createUser({ role: "admin" });
      const response = await createMileage(token, vehicle.id, {
        logDate: "2026-10-28",
        mileage: 100,
        loggedByUserId: other.id,
      });
      expect(response.status).toBe(201);
      expect(response.body.loggedByUserId).toBe(user.id);
    });

    it("Mileage logs list newest first", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const older = await createMileage(token, vehicle.id, { logDate: "2026-10-20", mileage: 100 });
      const newer = await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 200 });
      const response = await listMileage(token, vehicle.id);
      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id)).toEqual([newer.body.id, older.body.id]);
    });

    it("Mileage logs on the same date sort by id descending", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const first = await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 100 });
      const second = await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 200 });
      const response = await listMileage(token, vehicle.id);
      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id)).toEqual([second.body.id, first.body.id]);
    });
  });

  describe("US-12.3 — Log a vehicle service", () => {
    it("Maintenance creates an oil change service log", async () => {
      const vehicle = await makeVehicle();
      const { user, token } = await signInAs("maintenance");
      const response = await createService(token, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "oil_change",
        note: "Synthetic oil, filter replaced.",
      });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        vehicleId: vehicle.id,
        serviceDate: "2026-10-28",
        serviceType: "oil_change",
        note: "Synthetic oil, filter replaced.",
        loggedByUserId: user.id,
      });
    });

    it("Repair and tire replacement service types are accepted", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      for (const serviceType of ["repair", "tire_replacement"]) {
        const response = await createService(token, vehicle.id, {
          serviceDate: "2026-10-28",
          serviceType,
        });
        expect(response.status).toBe(201);
        expect(response.body.serviceType).toBe(serviceType);
      }
    });

    it("Optional service note may be omitted", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const response = await createService(token, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "repair",
      });
      expect(response.status).toBe(201);
      expect(response.body.note).toBeNull();
    });

    it("Blank service note is stored as null", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const response = await createService(token, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "repair",
        note: "   ",
      });
      expect(response.status).toBe(201);
      expect(response.body.note).toBeNull();
    });

    it("Service note is trimmed", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const response = await createService(token, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "repair",
        note: "  Keep case and  spaces  ",
      });
      expect(response.status).toBe(201);
      expect(response.body.note).toBe("Keep case and  spaces");
    });

    it("Oversized service note is rejected", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const response = await createService(token, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "repair",
        note: "x".repeat(1001),
      });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid service log data." });
    });

    it("Unknown service type is rejected", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const before = await db.serviceLog.count();
      const response = await createService(token, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "wash",
      });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid service log data." });
      expect(await db.serviceLog.count()).toBe(before);
    });

    it("Invalid service date is rejected", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const response = await createService(token, vehicle.id, {
        serviceDate: "2026-13-01",
        serviceType: "repair",
      });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid service log data." });
    });

    it("Service logs list newest first", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const older = await createService(token, vehicle.id, {
        serviceDate: "2026-10-20",
        serviceType: "repair",
      });
      const newer = await createService(token, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "oil_change",
      });
      const response = await listService(token, vehicle.id);
      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id)).toEqual([newer.body.id, older.body.id]);
    });

    it("Service logs on the same date sort by id descending", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("maintenance");
      const first = await createService(token, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "repair",
      });
      const second = await createService(token, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "oil_change",
      });
      const response = await listService(token, vehicle.id);
      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id)).toEqual([second.body.id, first.body.id]);
    });
  });

  describe("US-12.4 — Restrict mileage and service log access", () => {
    it("Maintenance log APIs require a session", async () => {
      const vehicle = await makeVehicle();
      for (const response of [
        await listVehicles(),
        await listMileage(undefined, vehicle.id),
        await createMileage(undefined, vehicle.id, { logDate: "2026-10-28", mileage: 1 }),
        await listService(undefined, vehicle.id),
        await createService(undefined, vehicle.id, { serviceDate: "2026-10-28", serviceType: "repair" }),
      ]) {
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
      expect(await db.mileageLog.count()).toBe(0);
      expect(await db.serviceLog.count()).toBe(0);
    });

    it("Requestor cannot use maintenance logging", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("requestor");
      for (const response of [
        await listVehicles(token),
        await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 1 }),
        await createService(token, vehicle.id, { serviceDate: "2026-10-28", serviceType: "repair" }),
      ]) {
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
    });

    it("Area admin cannot use maintenance logging", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("area_admin", { areaId: area1.id });
      for (const response of [
        await listVehicles(token),
        await createMileage(token, vehicle.id, { logDate: "2026-10-28", mileage: 1 }),
        await createService(token, vehicle.id, { serviceDate: "2026-10-28", serviceType: "repair" }),
      ]) {
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
    });

    it("Missing vehicle is rejected for logs", async () => {
      const { token } = await signInAs("admin");
      for (const response of [
        await listMileage(token, 9999),
        await createMileage(token, 9999, { logDate: "2026-10-28", mileage: 1 }),
        await listService(token, 9999),
        await createService(token, 9999, { serviceDate: "2026-10-28", serviceType: "repair" }),
      ]) {
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ message: "Vehicle with id=9999 not found." });
      }
    });

    it("Invalid vehicle id is rejected for logs", async () => {
      const { token } = await signInAs("admin");
      for (const id of ["abc", "0", "-1", "9007199254740992"]) {
        for (const response of [
          await listMileage(token, id),
          await createMileage(token, id, { logDate: "2026-10-28", mileage: 1 }),
          await listService(token, id),
          await createService(token, id, { serviceDate: "2026-10-28", serviceType: "repair" }),
        ]) {
          expect(response.status).toBe(400);
          expect(response.body).toEqual({ message: "Vehicle id must be a positive integer." });
        }
      }
    });

    it("Mileage and service storage failures return a safe error", async () => {
      const vehicle = await makeVehicle();
      const { token } = await signInAs("admin");
      const failures = [
        [() => jest.spyOn(db.mileageLog, "findAll").mockRejectedValueOnce(new Error("SQLSTATE connection lost")), () => listMileage(token, vehicle.id), "Mileage request failed."],
        [() => jest.spyOn(db.serviceLog, "findAll").mockRejectedValueOnce(new Error("SQLSTATE connection lost")), () => listService(token, vehicle.id), "Service log request failed."],
        [() => jest.spyOn(db.vehicle, "findAll").mockRejectedValueOnce(new Error("SQLSTATE connection lost")), () => listVehicles(token), "Mileage request failed."],
      ];
      for (const [arm, run, message] of failures) {
        const spy = arm();
        const response = await run();
        spy.mockRestore();
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ message });
        expect(JSON.stringify(response.body)).not.toMatch(/SQLSTATE|connection lost/i);
      }
    });

    it("Referenced vehicle cannot be deleted while logs exist", async () => {
      const vehicle = await makeVehicle();
      const { token: maintToken } = await signInAs("maintenance");
      await createMileage(maintToken, vehicle.id, { logDate: "2026-10-28", mileage: 100 });
      const { token: adminToken } = await signInAs("admin");
      const response = await deleteVehicle(adminToken, vehicle.id);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Vehicle is in use." });
      expect(await db.vehicle.findByPk(vehicle.id)).not.toBeNull();
      expect(await db.mileageLog.count()).toBe(1);
    });

    it("Referenced logger user cannot be deleted while in use", async () => {
      const vehicle = await makeVehicle();
      const { user, token: maintToken } = await signInAs("maintenance");
      await createService(maintToken, vehicle.id, {
        serviceDate: "2026-10-28",
        serviceType: "repair",
      });
      const { token: adminToken } = await signInAs("admin");
      const response = await deleteUser(adminToken, user.id);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "User is in use." });
      expect(await db.user.findByPk(user.id)).not.toBeNull();
      expect(await db.serviceLog.count()).toBe(1);
    });
  });
});
