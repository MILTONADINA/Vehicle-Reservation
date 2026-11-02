/**
 * Feature 7 — Reservation Requests
 * Spec: features/feature-7-reservation-requests.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { syncTestDatabase, signInAs, createUser } from "./helpers.js";

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const listRequests = (token) => auth(request(app).get("/vehicle-t6/reservation-requests"), token);
const createRequest = (token, body) => auth(request(app).post("/vehicle-t6/reservation-requests"), token).send(body);
const updateRequest = (token, id, body) => auth(request(app).put(`/vehicle-t6/reservation-requests/${id}`), token).send(body);
const cancelRequest = (token, id) => auth(request(app).put(`/vehicle-t6/reservation-requests/${id}/cancel`), token).send({});
const deleteArea = (token, id) => auth(request(app).delete(`/vehicle-t6/areas/${id}`), token);
const deleteDriver = (token, id) => auth(request(app).delete(`/vehicle-t6/drivers/${id}`), token);
const deleteDestination = (token, id) => auth(request(app).delete(`/vehicle-t6/destinations/${id}`), token);

let area, area2, driver, approvedDriver, inactiveDriver, destination, inactiveDestination;

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

const validCatalogBody = (opts = {}) => ({
  areaId: opts.areaId || area.id,
  driverId: opts.driverId || approvedDriver.id,
  destinationId: opts.destinationId || destination.id,
  destinationCity: null,
  estimatedMiles: null,
  departureDate: "2026-12-01",
  departureTime: "08:30",
  returnDate: "2026-12-01",
  returnTime: "17:00",
  passengers: 4,
  purpose: "Conference shuttle",
  noteType: "special_instructions",
  noteText: "Need wheelchair access",
  ...opts,
});

const validFreetextBody = (opts = {}) => ({
  areaId: opts.areaId || area.id,
  driverId: opts.driverId || approvedDriver.id,
  destinationId: null,
  destinationCity: "Norman",
  estimatedMiles: 40.5,
  departureDate: "2026-12-01",
  departureTime: null,
  returnDate: "2026-12-02",
  returnTime: null,
  passengers: 2,
  purpose: "Field trip",
  noteType: null,
  noteText: null,
  ...opts,
});

const requestPayload = (row) => ({
  id: row.id,
  requestorUserId: row.requestorUserId,
  areaId: row.areaId,
  driverId: row.driverId,
  destinationId: row.destinationId,
  destinationCity: row.destinationCity,
  estimatedMiles: row.estimatedMiles !== null ? Number(row.estimatedMiles) : null,
  departureDate: row.departureDate,
  departureTime: row.departureTime,
  returnDate: row.returnDate,
  returnTime: row.returnTime,
  passengers: row.passengers,
  purpose: row.purpose,
  noteType: row.noteType,
  noteText: row.noteText,
  status: row.status,
});

beforeEach(async () => {
  await syncTestDatabase();
  area = await makeArea({ areaName: "Area 1" });
  area2 = await makeArea({ areaName: "Area 2" });
  approvedDriver = await makeDriver({ status: "approved" });
  inactiveDriver = await makeDriver({ firstName: "Inactive", status: "inactive" });
  destination = await makeDestination({ destinationName: "OKC Airport", status: "active" });
  inactiveDestination = await makeDestination({ destinationName: "Closed Dest", status: "inactive" });
});
afterAll(async () => { await db.sequelize.close(); });

describe("Feature 7 — Reservation Requests", () => {
  describe("US-7.1 — View reservation requests", () => {
    it("Requestor lists only own reservation requests", async () => {
      const { user: userA, token: tokenA } = await signInAs("requestor");
      const { user: userB } = await signInAs("requestor");

      const req1 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: userA.id,
        status: "requested",
        departureDate: "2026-12-01",
        departureTime: "08:00",
      });
      await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: userB.id,
        status: "requested",
        departureDate: "2026-12-01",
        departureTime: "09:00",
      });

      const response = await listRequests(tokenA);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(req1.id);
    });

    it("Admin lists every reservation request", async () => {
      const { user: userA } = await signInAs("requestor");
      const { user: userB } = await signInAs("requestor");
      const { token: adminToken } = await signInAs("admin");

      await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: userA.id,
        status: "requested",
        departureDate: "2026-12-02",
        departureTime: "10:00",
      });
      await db.reservationRequest.create({
        ...validCatalogBody({ areaId: area2.id }),
        requestorUserId: userB.id,
        status: "requested",
        departureDate: "2026-12-01",
        departureTime: "08:00",
      });

      const response = await listRequests(adminToken);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].departureDate).toBe("2026-12-01");
      expect(response.body[1].departureDate).toBe("2026-12-02");
    });

    it("Area admin lists only requests for its area", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: aaToken } = await signInAs("area_admin", { areaId: area2.id });

      await db.reservationRequest.create({
        ...validCatalogBody({ areaId: area.id }),
        requestorUserId: reqUser.id,
        status: "requested",
      });
      const req2 = await db.reservationRequest.create({
        ...validCatalogBody({ areaId: area2.id }),
        requestorUserId: reqUser.id,
        status: "requested",
      });

      const response = await listRequests(aaToken);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(req2.id);
    });

    it("Area admin without an assignment gets an empty reservation request list", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const { token: aaToken } = await signInAs("area_admin", { areaId: null });

      await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: reqUser.id,
        status: "requested",
      });

      const response = await listRequests(aaToken);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Empty reservation request list is returned", async () => {
      const { token } = await signInAs("requestor");
      const response = await listRequests(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Maintenance cannot access reservation requests", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const req1 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: reqUser.id,
        status: "requested",
      });
      const { token: mToken } = await signInAs("maintenance");

      const getRes = await listRequests(mToken);
      expect(getRes.status).toBe(403);
      expect(getRes.body).toEqual({ message: "Forbidden." });

      const postRes = await createRequest(mToken, validCatalogBody());
      expect(postRes.status).toBe(403);
      expect(postRes.body).toEqual({ message: "Forbidden." });

      const putRes = await updateRequest(mToken, req1.id, validCatalogBody());
      expect(putRes.status).toBe(403);
      expect(putRes.body).toEqual({ message: "Forbidden." });

      const cancelRes = await cancelRequest(mToken, req1.id);
      expect(cancelRes.status).toBe(403);
      expect(cancelRes.body).toEqual({ message: "Forbidden." });
    });

    it("Reservation request API requires a session", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const req1 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: reqUser.id,
        status: "requested",
      });

      const attempts = [
        listRequests(),
        createRequest(undefined, validCatalogBody()),
        updateRequest(undefined, req1.id, validCatalogBody()),
        cancelRequest(undefined, req1.id),
      ];
      for (const pending of attempts) {
        const response = await pending;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
    });
  });

  describe("US-7.2 — Submit a reservation request", () => {
    it("Requestor creates a requested reservation with a catalog destination", async () => {
      const { token } = await signInAs("requestor");
      const body = validCatalogBody();
      const response = await createRequest(token, body);
      expect(response.status).toBe(201);
      expect(Number.isInteger(response.body.id)).toBe(true);
      expect(response.body.status).toBe("requested");
      expect(response.body.areaId).toBe(area.id);
      expect(response.body.driverId).toBe(approvedDriver.id);
      expect(response.body.destinationId).toBe(destination.id);
      expect(response.body.destinationCity).toBeNull();
      expect(response.body.estimatedMiles).toBeNull();
      expect(response.body.departureDate).toBe("2026-12-01");
      expect(response.body.departureTime).toBe("08:30");
      expect(response.body.returnDate).toBe("2026-12-01");
      expect(response.body.returnTime).toBe("17:00");
      expect(response.body.passengers).toBe(4);
      expect(response.body.purpose).toBe("Conference shuttle");
      expect(response.body.noteType).toBe("special_instructions");
      expect(response.body.noteText).toBe("Need wheelchair access");
    });

    it("Requestor creates a whole-day request with free-text city mileage", async () => {
      const { token } = await signInAs("requestor");
      const body = validFreetextBody();
      const response = await createRequest(token, body);
      expect(response.status).toBe(201);
      expect(response.body.status).toBe("requested");
      expect(response.body.destinationId).toBeNull();
      expect(response.body.destinationCity).toBe("Norman");
      expect(response.body.estimatedMiles).toBe(40.5);
      expect(response.body.departureTime).toBeNull();
      expect(response.body.returnTime).toBeNull();
    });

    it("Requestor identity comes from the session", async () => {
      const { user, token } = await signInAs("requestor");
      const { user: otherUser } = await signInAs("requestor");
      const body = { ...validCatalogBody(), requestorUserId: otherUser.id, status: "reserved" };
      const response = await createRequest(token, body);
      expect(response.status).toBe(201);
      expect(response.body.requestorUserId).toBe(user.id);
      expect(response.body.status).toBe("requested");
    });

    it("Mixed destination modes are rejected", async () => {
      const { token } = await signInAs("requestor");
      const body = {
        ...validCatalogBody(),
        destinationCity: "Norman",
        estimatedMiles: 40.5,
      };
      const response = await createRequest(token, body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid reservation request data." });
      expect(await db.reservationRequest.count()).toBe(0);
    });

    it("Non-approved driver is rejected", async () => {
      const { token } = await signInAs("requestor");
      const body = validCatalogBody({ driverId: inactiveDriver.id });
      const response = await createRequest(token, body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid reservation request data." });
      expect(await db.reservationRequest.count()).toBe(0);
    });

    it("Inactive destination is rejected", async () => {
      const { token } = await signInAs("requestor");
      const body = validCatalogBody({ destinationId: inactiveDestination.id });
      const response = await createRequest(token, body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid reservation request data." });
      expect(await db.reservationRequest.count()).toBe(0);
    });

    it("Missing area on reservation request is rejected", async () => {
      const { token } = await signInAs("requestor");
      const body = validCatalogBody({ areaId: 9999 });
      const response = await createRequest(token, body);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Area with id=9999 not found." });
      expect(await db.reservationRequest.count()).toBe(0);
    });

    it("Return before departure is rejected", async () => {
      const { token } = await signInAs("requestor");
      const body = validCatalogBody({
        departureDate: "2026-12-01",
        departureTime: "17:00",
        returnDate: "2026-12-01",
        returnTime: "08:00",
      });
      const response = await createRequest(token, body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Invalid reservation request data." });
      expect(await db.reservationRequest.count()).toBe(0);
    });

    it("One-sided times are rejected", async () => {
      const { token } = await signInAs("requestor");
      for (const times of [
        { departureTime: "08:00", returnTime: null },
        { departureTime: null, returnTime: "17:00" },
      ]) {
        const body = validCatalogBody({
          ...times,
          departureDate: "2026-12-01",
          returnDate: "2026-12-01",
        });
        const response = await createRequest(token, body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid reservation request data." });
      }
      expect(await db.reservationRequest.count()).toBe(0);
    });

    it("Invalid passengers on reservation request are rejected", async () => {
      const { token } = await signInAs("requestor");
      for (const passengers of [0, 16]) {
        const body = validCatalogBody({ passengers });
        const response = await createRequest(token, body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid reservation request data." });
      }
      expect(await db.reservationRequest.count()).toBe(0);
    });

    it("Optional notes require both type and text", async () => {
      const { token } = await signInAs("requestor");
      for (const notes of [
        { noteType: "general", noteText: null },
        { noteType: null, noteText: "Some note" },
      ]) {
        const body = validCatalogBody(notes);
        const response = await createRequest(token, body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid reservation request data." });
      }
      expect(await db.reservationRequest.count()).toBe(0);
    });

    it("Admin and area admin cannot create a reservation request", async () => {
      for (const role of ["admin", "area_admin"]) {
        const { token } = await signInAs(role);
        const response = await createRequest(token, validCatalogBody());
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await db.reservationRequest.count()).toBe(0);
    });

    it("Referenced destination cannot be deleted while in use", async () => {
      const { user, token: reqToken } = await signInAs("requestor");
      await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: user.id,
        status: "requested",
      });
      const { token: adminToken } = await signInAs("admin");
      const response = await deleteDestination(adminToken, destination.id);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Destination is in use." });
      expect(await db.destination.findByPk(destination.id)).not.toBeNull();
      expect(await db.reservationRequest.count()).toBe(1);
    });

    it("Referenced driver cannot be deleted while in use", async () => {
      const { user } = await signInAs("requestor");
      await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: user.id,
        status: "requested",
      });
      const { token: adminToken } = await signInAs("admin");
      const response = await deleteDriver(adminToken, approvedDriver.id);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Driver is in use." });
      expect(await db.driver.findByPk(approvedDriver.id)).not.toBeNull();
      expect(await db.reservationRequest.count()).toBe(1);
    });

    it("Referenced area cannot be deleted while in use", async () => {
      const { user } = await signInAs("requestor");
      await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: user.id,
        status: "requested",
      });
      const { token: adminToken } = await signInAs("admin");
      const response = await deleteArea(adminToken, area.id);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Area is in use." });
      expect(await db.area.findByPk(area.id)).not.toBeNull();
      expect(await db.reservationRequest.count()).toBe(1);
    });
  });

  describe("US-7.3 — Edit a requested reservation request", () => {
    it("Requestor updates own requested reservation request", async () => {
      const { user, token } = await signInAs("requestor");
      const req1 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: user.id,
        status: "requested",
      });
      const updatedBody = validCatalogBody({
        passengers: 10,
        purpose: "Updated purpose",
        departureDate: "2026-12-05",
        departureTime: "09:00",
        returnDate: "2026-12-05",
        returnTime: "18:00",
      });
      const response = await updateRequest(token, req1.id, updatedBody);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(req1.id);
      expect(response.body.requestorUserId).toBe(user.id);
      expect(response.body.status).toBe("requested");
      expect(response.body.passengers).toBe(10);
      expect(response.body.purpose).toBe("Updated purpose");
    });

    it("Requestor cannot update another users reservation request", async () => {
      const { user: userB } = await signInAs("requestor");
      const { token: tokenA } = await signInAs("requestor");
      const req2 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: userB.id,
        status: "requested",
      });

      const response = await updateRequest(tokenA, req2.id, validCatalogBody());
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${req2.id} not found.` });

      const unchanged = await db.reservationRequest.findByPk(req2.id);
      expect(unchanged.requestorUserId).toBe(userB.id);
    });

    it("Requestor cannot update a non-requested reservation request", async () => {
      const { user, token } = await signInAs("requestor");
      const req4 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: user.id,
        status: "cancelled",
      });

      const response = await updateRequest(token, req4.id, validCatalogBody());
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${req4.id} not found.` });

      const unchanged = await db.reservationRequest.findByPk(req4.id);
      expect(unchanged.status).toBe("cancelled");
    });

    it("Admin and area admin cannot update a reservation request", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const req1 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: reqUser.id,
        status: "requested",
      });

      for (const role of ["admin", "area_admin"]) {
        const { token } = await signInAs(role);
        const response = await updateRequest(token, req1.id, validCatalogBody());
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }

      const unchanged = await db.reservationRequest.findByPk(req1.id);
      expect(unchanged.status).toBe("requested");
    });

    it("Invalid reservation request route id is rejected", async () => {
      const { token } = await signInAs("requestor");
      for (const id of ["abc", "0", "-1", "9007199254740992"]) {
        const putRes = await updateRequest(token, id, validCatalogBody());
        expect(putRes.status).toBe(400);
        expect(putRes.body).toEqual({ message: "Reservation request id must be a positive integer." });

        const cancelRes = await cancelRequest(token, id);
        expect(cancelRes.status).toBe(400);
        expect(cancelRes.body).toEqual({ message: "Reservation request id must be a positive integer." });
      }
    });
  });

  describe("US-7.4 — Cancel a requested reservation request", () => {
    it("Requestor cancels own requested reservation request", async () => {
      const { user, token } = await signInAs("requestor");
      const req3 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: user.id,
        status: "requested",
      });

      const response = await cancelRequest(token, req3.id);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("cancelled");
      expect(response.body.id).toBe(req3.id);

      const row = await db.reservationRequest.findByPk(req3.id);
      expect(row).not.toBeNull();
      expect(row.status).toBe("cancelled");
    });

    it("Missing reservation request id returns not found on put or cancel", async () => {
      const { token } = await signInAs("requestor");

      const putRes = await updateRequest(token, 9999, validCatalogBody());
      expect(putRes.status).toBe(404);
      expect(putRes.body).toEqual({ message: "Reservation request with id=9999 not found." });

      const cancelRes = await cancelRequest(token, 9999);
      expect(cancelRes.status).toBe(404);
      expect(cancelRes.body).toEqual({ message: "Reservation request with id=9999 not found." });
    });

    it("Requestor cannot cancel another users reservation request", async () => {
      const { user: userB } = await signInAs("requestor");
      const { token: tokenA } = await signInAs("requestor");
      const req2 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: userB.id,
        status: "requested",
      });

      const response = await cancelRequest(tokenA, req2.id);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${req2.id} not found.` });

      const unchanged = await db.reservationRequest.findByPk(req2.id);
      expect(unchanged.status).toBe("requested");
    });

    it("Requestor cannot cancel a non-requested reservation request", async () => {
      const { user, token } = await signInAs("requestor");
      const req4 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: user.id,
        status: "cancelled",
      });

      const response = await cancelRequest(token, req4.id);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Reservation request with id=${req4.id} not found.` });

      const unchanged = await db.reservationRequest.findByPk(req4.id);
      expect(unchanged.status).toBe("cancelled");
    });

    it("Admin and area admin cannot cancel a reservation request in Feature 7", async () => {
      const { user: reqUser } = await signInAs("requestor");
      const req3 = await db.reservationRequest.create({
        ...validCatalogBody(),
        requestorUserId: reqUser.id,
        status: "requested",
      });

      for (const role of ["admin", "area_admin"]) {
        const { token } = await signInAs(role);
        const response = await cancelRequest(token, req3.id);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }

      const unchanged = await db.reservationRequest.findByPk(req3.id);
      expect(unchanged.status).toBe("requested");
    });
  });
});
