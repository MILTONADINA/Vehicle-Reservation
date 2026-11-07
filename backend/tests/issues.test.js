/**
 * Feature 10 — Vehicle Issue Reports
 * Spec: features/feature-10-vehicle-issue-reports.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { syncTestDatabase, signInAs } from "./helpers.js";

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const createIssue = (token, requestId, body) =>
  auth(request(app).post(`/vehicle-t6/reservation-requests/${requestId}/issues`), token).send(body);
const listForRequest = (token, requestId) =>
  auth(request(app).get(`/vehicle-t6/reservation-requests/${requestId}/issues`), token);
const listOpen = (token) => auth(request(app).get("/vehicle-t6/issues"), token);
const deleteUser = (token, id) => auth(request(app).delete(`/vehicle-t6/users/${id}`), token);
const deleteVehicle = (token, id) => auth(request(app).delete(`/vehicle-t6/vehicles/${id}`), token);

const issueKeys = ["createdAt", "id", "issueType", "note", "reportedByUserId", "requestId", "timing", "vehicleId"];

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
    make: "Toyota",
    model: "Sienna",
    year: 2024,
    vin: `VIN${String(vehicleCounter).padStart(14, "0")}`,
    purchasedDate: "2024-01-01",
    color: "White",
    passengers: 8,
    plateNumber: `PLT${String(vehicleCounter).padStart(7, "0")}`,
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
    departureDate: "2026-12-01",
    departureTime: "08:00",
    returnDate: "2026-12-01",
    returnTime: "17:00",
    passengers: 4,
    purpose: "Trip purpose",
    noteType: null,
    noteText: null,
    vehicleId: null,
    statusReason: null,
    status: "requested",
    ...overrides,
  });

const issueSnapshot = async () =>
  (await db.issueReport.findAll({ order: [["id", "ASC"]] })).map((row) => ({
    id: row.id,
    requestId: row.requestId,
    vehicleId: row.vehicleId,
    issueType: row.issueType,
    timing: row.timing,
    note: row.note,
    reportedByUserId: row.reportedByUserId,
  }));

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

describe("Feature 10 — Vehicle Issue Reports", () => {
  describe("US-10.1 — Report a vehicle issue", () => {
    it("Requestor reports low gas after a trip", async () => {
      const { user, token } = await signInAs("requestor");
      const vehicle = await makeVehicle();
      const reservation = await makeRequest({ requestorUserId: user.id, vehicleId: vehicle.id, status: "returned" });

      const response = await createIssue(token, reservation.id, {
        issueType: "low_gas",
        timing: "after",
        note: "Tank was near empty on return.",
      });

      expect(response.status).toBe(201);
      expect(response.body.requestId).toBe(reservation.id);
      expect(response.body.vehicleId).toBe(vehicle.id);
      expect(response.body.issueType).toBe("low_gas");
      expect(response.body.timing).toBe("after");
      expect(response.body.note).toBe("Tank was near empty on return.");
      expect(response.body.reportedByUserId).toBe(user.id);
      expect(response.body.id).toEqual(expect.any(Number));
      expect(response.body.createdAt).toEqual(expect.any(String));
      expect(Object.keys(response.body).sort()).toEqual(issueKeys);
    });

    it("Requestor reports dirty and maintenance need with each timing", async () => {
      const { user, token } = await signInAs("requestor");
      const reservation = await makeRequest({ requestorUserId: user.id });

      const dirty = await createIssue(token, reservation.id, { issueType: "dirty", timing: "during" });
      const maintenance = await createIssue(token, reservation.id, {
        issueType: "maintenance_need",
        timing: "before",
      });

      expect(dirty.status).toBe(201);
      expect(dirty.body.issueType).toBe("dirty");
      expect(dirty.body.timing).toBe("during");
      expect(maintenance.status).toBe(201);
      expect(maintenance.body.issueType).toBe("maintenance_need");
      expect(maintenance.body.timing).toBe("before");
    });

    it("Optional note may be omitted", async () => {
      const { user, token } = await signInAs("requestor");
      const reservation = await makeRequest({ requestorUserId: user.id });

      const response = await createIssue(token, reservation.id, {
        issueType: "low_gas",
        timing: "before",
      });

      expect(response.status).toBe(201);
      expect(response.body.note).toBeNull();
    });

    it("Blank note is stored as null", async () => {
      const { user, token } = await signInAs("requestor");
      const reservation = await makeRequest({ requestorUserId: user.id });

      const response = await createIssue(token, reservation.id, {
        issueType: "dirty",
        timing: "after",
        note: "   ",
      });

      expect(response.status).toBe(201);
      expect(response.body.note).toBeNull();
      const stored = await db.issueReport.findByPk(response.body.id);
      expect(stored.note).toBeNull();
    });

    it("Requestor cannot report on another users request", async () => {
      const { token } = await signInAs("requestor");
      const { user: other } = await signInAs("requestor");
      const reservation = await makeRequest({ requestorUserId: other.id });
      const before = await issueSnapshot();

      const response = await createIssue(token, reservation.id, {
        issueType: "low_gas",
        timing: "after",
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${reservation.id} not found.` });
      expect(await issueSnapshot()).toEqual(before);
    });

    it("Area admin reports an issue in its area", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { user: areaAdmin, token } = await signInAs("area_admin", { areaId: area1.id });
      const reservation = await makeRequest({ requestorUserId: requestor.id, areaId: area1.id });

      const response = await createIssue(token, reservation.id, {
        issueType: "dirty",
        timing: "during",
        note: "Seats need cleaning.",
      });

      expect(response.status).toBe(201);
      expect(response.body.reportedByUserId).toBe(areaAdmin.id);
    });

    it("Area admin cannot report on another areas request", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("area_admin", { areaId: area2.id });
      const reservation = await makeRequest({ requestorUserId: requestor.id, areaId: area1.id });
      const before = await issueSnapshot();

      const response = await createIssue(token, reservation.id, {
        issueType: "low_gas",
        timing: "before",
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${reservation.id} not found.` });
      expect(await issueSnapshot()).toEqual(before);
    });

    it("Invalid issue type or timing is rejected", async () => {
      const { user, token } = await signInAs("requestor");
      const reservation = await makeRequest({ requestorUserId: user.id });
      const before = await issueSnapshot();

      for (const body of [
        { issueType: "flat_tire", timing: "after" },
        { issueType: "low_gas", timing: "midway" },
        { issueType: "low_gas", timing: "after", note: "x".repeat(1001) },
        { issueType: "low_gas", timing: "after", note: 42 },
      ]) {
        const response = await createIssue(token, reservation.id, body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid issue data." });
      }
      expect(await issueSnapshot()).toEqual(before);
    });

    it("Client cannot choose vehicle id or reporter", async () => {
      const { user, token } = await signInAs("requestor");
      const { user: otherUser } = await signInAs("requestor");
      const vehicle = await makeVehicle();
      const otherVehicle = await makeVehicle();
      const reservation = await makeRequest({
        requestorUserId: user.id,
        vehicleId: vehicle.id,
        status: "reserved",
      });

      const response = await createIssue(token, reservation.id, {
        issueType: "maintenance_need",
        timing: "during",
        vehicleId: otherVehicle.id,
        reportedByUserId: otherUser.id,
      });

      expect(response.status).toBe(201);
      expect(response.body.vehicleId).toBe(vehicle.id);
      expect(response.body.reportedByUserId).toBe(user.id);
      expect(response.body.reportedByUserId).not.toBe(otherUser.id);
    });
  });

  describe("US-10.2 — View issue reports", () => {
    it("Requestor lists issues on their request", async () => {
      const { user, token } = await signInAs("requestor");
      const reservation = await makeRequest({ requestorUserId: user.id });
      const first = await db.issueReport.create({
        requestId: reservation.id,
        vehicleId: null,
        issueType: "low_gas",
        timing: "before",
        note: null,
        reportedByUserId: user.id,
        createdAt: new Date("2026-10-27T17:00:00.000Z"),
      });
      const second = await db.issueReport.create({
        requestId: reservation.id,
        vehicleId: null,
        issueType: "dirty",
        timing: "after",
        note: "Muddy",
        reportedByUserId: user.id,
        createdAt: new Date("2026-10-27T18:00:00.000Z"),
      });

      const response = await listForRequest(token, reservation.id);
      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id)).toEqual([first.id, second.id]);
      expect(Object.keys(response.body[0]).sort()).toEqual(issueKeys);
    });

    it("Empty issue list is returned", async () => {
      const { user, token } = await signInAs("requestor");
      const reservation = await makeRequest({ requestorUserId: user.id });

      const response = await listForRequest(token, reservation.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Admin lists every open issue", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("admin");
      const req1 = await makeRequest({ requestorUserId: requestor.id, areaId: area1.id });
      const req2 = await makeRequest({ requestorUserId: requestor.id, areaId: area2.id });
      const issue1 = await db.issueReport.create({
        requestId: req1.id,
        issueType: "low_gas",
        timing: "before",
        reportedByUserId: requestor.id,
      });
      const issue2 = await db.issueReport.create({
        requestId: req2.id,
        issueType: "dirty",
        timing: "after",
        reportedByUserId: requestor.id,
      });

      const response = await listOpen(token);
      expect(response.status).toBe(200);
      expect(response.body.map((row) => row.id).sort()).toEqual([issue1.id, issue2.id].sort());
    });

    it("Area admin lists only issues for its area", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("area_admin", { areaId: area2.id });
      const req1 = await makeRequest({ requestorUserId: requestor.id, areaId: area1.id });
      const req2 = await makeRequest({ requestorUserId: requestor.id, areaId: area2.id });
      await db.issueReport.create({
        requestId: req1.id,
        issueType: "low_gas",
        timing: "before",
        reportedByUserId: requestor.id,
      });
      const own = await db.issueReport.create({
        requestId: req2.id,
        issueType: "dirty",
        timing: "after",
        reportedByUserId: requestor.id,
      });

      const response = await listOpen(token);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(own.id);
    });

    it("Maintenance lists only maintenance need issues", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("maintenance");
      const reservation = await makeRequest({ requestorUserId: requestor.id });
      await db.issueReport.create({
        requestId: reservation.id,
        issueType: "low_gas",
        timing: "before",
        reportedByUserId: requestor.id,
      });
      const maintenance = await db.issueReport.create({
        requestId: reservation.id,
        issueType: "maintenance_need",
        timing: "during",
        reportedByUserId: requestor.id,
      });

      const response = await listOpen(token);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(maintenance.id);
      expect(response.body[0].issueType).toBe("maintenance_need");
    });

    it("Requestor cannot use the open issues list", async () => {
      const { token } = await signInAs("requestor");
      const response = await listOpen(token);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden." });
    });

    it("Listing issues on another users request is rejected", async () => {
      const { token } = await signInAs("requestor");
      const { user: other } = await signInAs("requestor");
      const reservation = await makeRequest({ requestorUserId: other.id });
      await db.issueReport.create({
        requestId: reservation.id,
        issueType: "dirty",
        timing: "before",
        reportedByUserId: other.id,
      });

      const response = await listForRequest(token, reservation.id);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${reservation.id} not found.` });
    });

    it("Area admin cannot list issues for another areas request", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("area_admin", { areaId: area2.id });
      const reservation = await makeRequest({ requestorUserId: requestor.id, areaId: area1.id });
      await db.issueReport.create({
        requestId: reservation.id,
        issueType: "low_gas",
        timing: "after",
        reportedByUserId: requestor.id,
      });

      const response = await listForRequest(token, reservation.id);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${reservation.id} not found.` });
    });
  });

  describe("US-10.3 — Restrict issue actions", () => {
    it("Issue APIs require a session", async () => {
      const { user } = await signInAs("requestor");
      const reservation = await makeRequest({ requestorUserId: user.id });
      const before = await issueSnapshot();

      const attempts = [
        createIssue(undefined, reservation.id, { issueType: "low_gas", timing: "after" }),
        listForRequest(undefined, reservation.id),
        listOpen(),
        auth(request(app).get("/vehicle-t6/issues"), "not-a-session"),
      ];
      for (const pending of attempts) {
        const response = await pending;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
      expect(await issueSnapshot()).toEqual(before);
    });

    it("Maintenance cannot create an issue", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("maintenance");
      const reservation = await makeRequest({ requestorUserId: requestor.id });
      const before = await issueSnapshot();

      const response = await createIssue(token, reservation.id, {
        issueType: "maintenance_need",
        timing: "after",
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden." });
      expect(await issueSnapshot()).toEqual(before);
    });

    it("Maintenance cannot list issues for one request", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token } = await signInAs("maintenance");
      const reservation = await makeRequest({ requestorUserId: requestor.id });

      const response = await listForRequest(token, reservation.id);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden." });
    });

    it("Invalid reservation request route id is rejected for issues", async () => {
      const { token } = await signInAs("admin");
      for (const id of ["abc", "0", "-1", "9007199254740992"]) {
        const create = await createIssue(token, id, { issueType: "low_gas", timing: "after" });
        expect(create.status).toBe(400);
        expect(create.body).toEqual({ message: "Reservation request id must be a positive integer." });

        const list = await listForRequest(token, id);
        expect(list.status).toBe(400);
        expect(list.body).toEqual({ message: "Reservation request id must be a positive integer." });
      }
    });

    it("Missing reservation request is rejected for issues", async () => {
      const { token } = await signInAs("admin");
      const response = await createIssue(token, 9999, { issueType: "low_gas", timing: "after" });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Reservation request with id=9999 not found." });
    });

    it("Referenced reporter user cannot be deleted while in use", async () => {
      const { user: reporter } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");
      const reservation = await makeRequest({ requestorUserId: reporter.id });
      const issue = await db.issueReport.create({
        requestId: reservation.id,
        issueType: "dirty",
        timing: "before",
        reportedByUserId: reporter.id,
      });

      // Reporter also owns the request, so clear that RESTRICT first by transferring ownership.
      const { user: other } = await signInAs("requestor");
      await reservation.update({ requestorUserId: other.id });

      const response = await deleteUser(adminToken, reporter.id);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "User is in use." });
      expect(await db.user.findByPk(reporter.id)).not.toBeNull();
      expect(await db.issueReport.findByPk(issue.id)).not.toBeNull();
    });

    it("Referenced vehicle cannot be deleted while issues exist", async () => {
      const { user: requestor } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");
      const vehicle = await makeVehicle();
      const reservation = await makeRequest({
        requestorUserId: requestor.id,
        vehicleId: vehicle.id,
        status: "reserved",
      });
      // Clear the request vehicle FK so only the issue report blocks delete.
      await reservation.update({ vehicleId: null, status: "cancelled" });
      const issue = await db.issueReport.create({
        requestId: reservation.id,
        vehicleId: vehicle.id,
        issueType: "maintenance_need",
        timing: "after",
        reportedByUserId: requestor.id,
      });

      const response = await deleteVehicle(adminToken, vehicle.id);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Vehicle is in use." });
      expect(await db.vehicle.findByPk(vehicle.id)).not.toBeNull();
      expect(await db.issueReport.findByPk(issue.id)).not.toBeNull();
    });

    it("Issue storage failures return a safe error", async () => {
      const { user, token } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");
      const reservation = await makeRequest({ requestorUserId: user.id });
      const before = await issueSnapshot();
      const body = { issueType: "low_gas", timing: "after", note: "Near empty" };
      const failures = [
        [() => jest.spyOn(db.issueReport, "create").mockRejectedValueOnce(new Error("SQLSTATE connection lost")), () => createIssue(token, reservation.id, body)],
        [() => jest.spyOn(db.issueReport, "findAll").mockRejectedValueOnce(new Error("SQLSTATE connection lost")), () => listForRequest(token, reservation.id)],
        [() => jest.spyOn(db.issueReport, "findAll").mockRejectedValueOnce(new Error("SQLSTATE connection lost")), () => listOpen(adminToken)],
      ];
      for (const [arm, run] of failures) {
        const spy = arm();
        const response = await run();
        spy.mockRestore();
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ message: "Issue request failed." });
        expect(JSON.stringify(response.body)).not.toMatch(/SQLSTATE|connection lost/i);
      }
      expect(await issueSnapshot()).toEqual(before);
    });
  });
});
