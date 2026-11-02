/**
 * Feature 8 — Request Processing
 * Spec: features/feature-8-request-processing.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { syncTestDatabase, signInAs } from "./helpers.js";

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const listRequests = (token) => auth(request(app).get("/vehicle-t6/reservation-requests"), token);
const getCandidates = (token, id) => auth(request(app).get(`/vehicle-t6/reservation-requests/${id}/candidate-vehicles`), token);
const changeStatus = (token, id, body) => auth(request(app).put(`/vehicle-t6/reservation-requests/${id}/status`), token).send(body);
const deleteVehicle = (token, id) => auth(request(app).delete(`/vehicle-t6/vehicles/${id}`), token);

let area1, area2, approvedDriver, destination;

const makeArea = (overrides = {}) =>
  db.area.create({
    areaName: `Area ${Date.now()}${Math.random()}`,
    areaLogo: "https://example.com/logo.png",
    noticeEmail: "notice@oc.edu",
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

const makeVehicle = (overrides = {}) =>
  db.vehicle.create({
    make: "Toyota",
    model: "Sienna",
    year: 2024,
    vin: `VIN${Date.now()}${Math.random()}`.replace(/[^A-Z0-9]/gi, "").substring(0, 17).toUpperCase(),
    purchasedDate: "2024-01-01",
    color: "White",
    passengers: 8,
    plateNumber: `PLT${Date.now()}`.substring(0, 10),
    plateExpireMonth: 6,
    designatedParking: "Lot A",
    areaId: area1 ? area1.id : 1,
    ...overrides,
  });

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
    status: "requested",
    ...overrides,
  });

beforeEach(async () => {
  await syncTestDatabase();
  area1 = await makeArea({ areaName: "Area 1" });
  area2 = await makeArea({ areaName: "Area 2" });
  approvedDriver = await makeDriver({ status: "approved" });
  destination = await makeDestination({ destinationName: "OKC Airport", status: "active" });
});
afterAll(async () => { await db.sequelize.close(); });

describe("Feature 8 — Request Processing", () => {
  describe("US-8.1 — View requests for processing", () => {
    it("Admin lists every reservation request for processing", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
        departureDate: "2026-12-02",
        departureTime: "10:00",
      });
      const r2 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area2.id,
        status: "awaiting_vehicle",
        departureDate: "2026-12-01",
        departureTime: "08:00",
      });
      const vehicle = await makeVehicle({ areaId: area1.id });
      const r3 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "reserved",
        vehicleId: vehicle.id,
        departureDate: "2026-12-03",
        departureTime: null,
        returnDate: "2026-12-04",
        returnTime: null,
      });
      const r4 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "cancelled",
        statusReason: "No vehicles",
        departureDate: "2026-12-01",
        departureTime: "07:00",
      });

      const response = await listRequests(adminToken);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4);
      // Departure order: r4 (12-01 07:00), r2 (12-01 08:00), r1 (12-02 10:00), r3 (12-03 null time)
      expect(response.body[0].id).toBe(r4.id);
      expect(response.body[1].id).toBe(r2.id);
      expect(response.body[2].id).toBe(r1.id);
      expect(response.body[3].id).toBe(r3.id);
      // Verify vehicleId and statusReason are included
      expect(response.body[0].statusReason).toBe("No vehicles");
      expect(response.body[0].vehicleId).toBeNull();
      expect(response.body[2].vehicleId).toBeNull();
      const reservedRow = response.body.find((r) => r.status === "reserved");
      expect(reservedRow.vehicleId).toBe(vehicle.id);
      expect(reservedRow.statusReason).toBeNull();
    });

    it("Area admin lists only its area requests for processing", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: aaToken } = await signInAs("area_admin", { areaId: area2.id });

      await makeRequest({ requestorUserId: reqUser.id, areaId: area1.id, status: "requested" });
      const r2 = await makeRequest({ requestorUserId: reqUser.id, areaId: area2.id, status: "requested" });

      const response = await listRequests(aaToken);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(r2.id);
    });

    it("Area admin without an assignment gets an empty processing list", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: aaToken } = await signInAs("area_admin", { areaId: null });

      await makeRequest({ requestorUserId: reqUser.id, areaId: area1.id, status: "requested" });

      const response = await listRequests(aaToken);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Requestor and maintenance cannot call processing endpoints", async () => {
      const { user: reqUser, token: reqToken } = await signInAs("requestor");
      const { token: maintToken } = await signInAs("maintenance");

      const r1 = await makeRequest({ requestorUserId: reqUser.id, areaId: area1.id, status: "requested" });

      for (const token of [reqToken, maintToken]) {
        const candRes = await getCandidates(token, r1.id);
        expect(candRes.status).toBe(403);
        expect(candRes.body).toEqual({ message: "Forbidden." });

        const statusRes = await changeStatus(token, r1.id, { status: "awaiting_vehicle" });
        expect(statusRes.status).toBe(403);
        expect(statusRes.body).toEqual({ message: "Forbidden." });
      }

      const unchanged = await db.reservationRequest.findByPk(r1.id);
      expect(unchanged.status).toBe("requested");
    });

    it("Processing API requires a session", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const r1 = await makeRequest({ requestorUserId: reqUser.id, areaId: area1.id, status: "requested" });

      const candRes = await getCandidates(undefined, r1.id);
      expect(candRes.status).toBe(401);
      expect(candRes.body).toEqual({ message: "Unauthorized." });

      const statusRes = await changeStatus(undefined, r1.id, { status: "awaiting_vehicle" });
      expect(statusRes.status).toBe(401);
      expect(statusRes.body).toEqual({ message: "Unauthorized." });

      const unchanged = await db.reservationRequest.findByPk(r1.id);
      expect(unchanged.status).toBe("requested");
    });
  });

  describe("US-8.2 — List candidate vehicles for reserving a request", () => {
    it("Admin lists candidate vehicles for a request awaiting reservation", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area2.id,
        status: "requested",
        passengers: 4,
        departureDate: "2026-12-10",
        departureTime: "08:00",
        returnDate: "2026-12-10",
        returnTime: "17:00",
      });

      const v1 = await makeVehicle({ areaId: area2.id, passengers: 4, make: "Ford", model: "Transit" });
      const v2 = await makeVehicle({ areaId: area2.id, passengers: 8, make: "Chevrolet", model: "Express" });
      // Wrong area — should be excluded
      await makeVehicle({ areaId: area1.id, passengers: 10, make: "Toyota", model: "Sienna" });

      const response = await getCandidates(adminToken, r1.id);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      // Sort: Chevrolet Express, then Ford Transit
      expect(response.body[0].id).toBe(v2.id);
      expect(response.body[0].make).toBe("Chevrolet");
      expect(response.body[1].id).toBe(v1.id);
      expect(response.body[1].make).toBe("Ford");
      // Verify vehicle shape
      expect(response.body[0]).toHaveProperty("vin");
      expect(response.body[0]).toHaveProperty("passengers");
      expect(response.body[0]).toHaveProperty("areaId");

      // Also test with awaiting_vehicle status
      await r1.update({ status: "awaiting_vehicle" });
      const response2 = await getCandidates(adminToken, r1.id);
      expect(response2.status).toBe(200);
      expect(response2.body).toHaveLength(2);
    });

    it("Area admin lists candidate vehicles in its area", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: aaToken } = await signInAs("area_admin", { areaId: area2.id });

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area2.id,
        status: "requested",
        passengers: 2,
      });

      const v1 = await makeVehicle({ areaId: area2.id, passengers: 4 });

      const response = await getCandidates(aaToken, r1.id);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(v1.id);
    });

    it("Vehicles below passenger capacity are omitted", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
        passengers: 8,
      });

      await makeVehicle({ areaId: area1.id, passengers: 6 });
      const v2 = await makeVehicle({ areaId: area1.id, passengers: 8 });

      const response = await getCandidates(adminToken, r1.id);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(v2.id);
    });

    it("Vehicles with overlapping reserved trips are omitted", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const vOverlap = await makeVehicle({ areaId: area1.id, passengers: 8 });
      const vFree = await makeVehicle({ areaId: area1.id, passengers: 8 });

      // Create an overlapping reserved request for vOverlap
      await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "reserved",
        vehicleId: vOverlap.id,
        departureDate: "2026-12-10",
        departureTime: "07:00",
        returnDate: "2026-12-10",
        returnTime: "12:00",
      });

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
        passengers: 4,
        departureDate: "2026-12-10",
        departureTime: "08:00",
        returnDate: "2026-12-10",
        returnTime: "17:00",
      });

      const response = await getCandidates(adminToken, r1.id);
      expect(response.status).toBe(200);
      const ids = response.body.map((v) => v.id);
      expect(ids).not.toContain(vOverlap.id);
      expect(ids).toContain(vFree.id);
    });

    it("Candidate vehicles for a missing request are rejected", async () => {
      const { token: adminToken } = await signInAs("admin");

      const response = await getCandidates(adminToken, 9999);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Reservation request with id=9999 not found." });
    });

    it("Candidate vehicles for a non-reservable status are rejected", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const vehicle = await makeVehicle({ areaId: area1.id });
      const r4 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "returned",
        vehicleId: vehicle.id,
      });

      const response = await getCandidates(adminToken, r4.id);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid reservation request data." });
    });

    it("Area admin cannot load candidates for another area request", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: aaToken } = await signInAs("area_admin", { areaId: area2.id });

      const r3 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
      });

      const response = await getCandidates(aaToken, r3.id);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${r3.id} not found.` });
    });
  });

  describe("US-8.3 — Change reservation request status", () => {
    it("Admin moves a requested trip to awaiting vehicle", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
      });

      const response = await changeStatus(adminToken, r1.id, { status: "awaiting_vehicle" });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("awaiting_vehicle");
      expect(response.body.vehicleId).toBeNull();
    });

    it("Admin reserves a requested trip with a valid vehicle", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const v12 = await makeVehicle({ areaId: area1.id, passengers: 8 });
      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
        passengers: 4,
      });

      const response = await changeStatus(adminToken, r1.id, { status: "reserved", vehicleId: v12.id });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("reserved");
      expect(response.body.vehicleId).toBe(v12.id);
    });

    it("Admin reserves a trip with a valid vehicle", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const v12 = await makeVehicle({ areaId: area1.id, passengers: 8 });
      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "awaiting_vehicle",
        passengers: 4,
      });

      const response = await changeStatus(adminToken, r1.id, { status: "reserved", vehicleId: v12.id });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("reserved");
      expect(response.body.vehicleId).toBe(v12.id);
    });

    it("Area admin reserves a trip in its area", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: aaToken } = await signInAs("area_admin", { areaId: area2.id });

      const v12 = await makeVehicle({ areaId: area2.id, passengers: 8 });
      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area2.id,
        status: "requested",
        passengers: 4,
      });

      const response = await changeStatus(aaToken, r1.id, { status: "reserved", vehicleId: v12.id });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("reserved");
      expect(response.body.vehicleId).toBe(v12.id);
    });

    it("Admin marks a reserved trip returned", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const v12 = await makeVehicle({ areaId: area1.id, passengers: 8 });
      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "reserved",
        vehicleId: v12.id,
        passengers: 4,
      });

      const response = await changeStatus(adminToken, r1.id, { status: "returned" });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("returned");
      expect(response.body.vehicleId).toBe(v12.id);
    });

    it("Admin cancels an awaiting vehicle trip with a reason", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "awaiting_vehicle",
      });

      const response = await changeStatus(adminToken, r1.id, {
        status: "cancelled",
        statusReason: "No vehicle available that weekend.",
      });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("cancelled");
      expect(response.body.vehicleId).toBeNull();
      expect(response.body.statusReason).toBe("No vehicle available that weekend.");
    });

    it("Admin cancels a reserved trip and clears the vehicle", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const v12 = await makeVehicle({ areaId: area1.id, passengers: 8 });
      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "reserved",
        vehicleId: v12.id,
        passengers: 4,
      });

      const response = await changeStatus(adminToken, r1.id, {
        status: "cancelled",
        statusReason: "Traveler withdrew after assignment.",
      });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("cancelled");
      expect(response.body.vehicleId).toBeNull();
      expect(response.body.statusReason).toBe("Traveler withdrew after assignment.");
    });

    it("Illegal status transition is rejected", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
      });

      const response = await changeStatus(adminToken, r1.id, { status: "returned" });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid reservation request data." });

      const unchanged = await db.reservationRequest.findByPk(r1.id);
      expect(unchanged.status).toBe("requested");
    });

    it("Reserve rejects a vehicle from another area", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const v8 = await makeVehicle({ areaId: area1.id, passengers: 8 });
      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area2.id,
        status: "requested",
        passengers: 4,
      });

      const response = await changeStatus(adminToken, r1.id, { status: "reserved", vehicleId: v8.id });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid reservation request data." });

      const unchanged = await db.reservationRequest.findByPk(r1.id);
      expect(unchanged.status).toBe("requested");
    });

    it("Reserve rejects an undersized vehicle", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const v7 = await makeVehicle({ areaId: area1.id, passengers: 6 });
      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
        passengers: 10,
      });

      const response = await changeStatus(adminToken, r1.id, { status: "reserved", vehicleId: v7.id });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid reservation request data." });

      const unchanged = await db.reservationRequest.findByPk(r1.id);
      expect(unchanged.status).toBe("requested");
    });

    it("Reserve rejects an overlapping vehicle assignment", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const v9 = await makeVehicle({ areaId: area1.id, passengers: 8 });

      await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "reserved",
        vehicleId: v9.id,
        departureDate: "2026-12-10",
        departureTime: "08:00",
        returnDate: "2026-12-10",
        returnTime: "17:00",
      });

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
        passengers: 4,
        departureDate: "2026-12-10",
        departureTime: "10:00",
        returnDate: "2026-12-10",
        returnTime: "14:00",
      });

      const response = await changeStatus(adminToken, r1.id, { status: "reserved", vehicleId: v9.id });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid reservation request data." });

      const unchanged = await db.reservationRequest.findByPk(r1.id);
      expect(unchanged.status).toBe("requested");
    });

    it("Reserve rejects a missing vehicle", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const r1 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
        passengers: 4,
      });

      const response = await changeStatus(adminToken, r1.id, { status: "reserved", vehicleId: 9999 });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Vehicle with id=9999 not found." });

      const unchanged = await db.reservationRequest.findByPk(r1.id);
      expect(unchanged.status).toBe("requested");
    });

    it("Area admin cannot change status for another area request", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: aaToken } = await signInAs("area_admin", { areaId: area2.id });

      const r3 = await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "requested",
      });

      const response = await changeStatus(aaToken, r3.id, { status: "awaiting_vehicle" });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${r3.id} not found.` });

      const unchanged = await db.reservationRequest.findByPk(r3.id);
      expect(unchanged.status).toBe("requested");
    });

    it("Referenced vehicle cannot be deleted while in use", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      const v12 = await makeVehicle({ areaId: area1.id, passengers: 8 });
      await makeRequest({
        requestorUserId: reqUser.id,
        areaId: area1.id,
        status: "reserved",
        vehicleId: v12.id,
        passengers: 4,
      });

      const response = await deleteVehicle(adminToken, v12.id);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Vehicle is in use." });

      expect(await db.vehicle.findByPk(v12.id)).not.toBeNull();
      expect(await db.reservationRequest.count()).toBe(1);
    });

    it("Invalid reservation request route id is rejected on status change", async () => {
      const { token: adminToken } = await signInAs("admin");

      for (const id of ["abc", "0", "-1", "9007199254740992"]) {
        const response = await changeStatus(adminToken, id, { status: "awaiting_vehicle" });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Reservation request id must be a positive integer." });
      }
    });
  });
});
