/**
 * Feature 4 — Vehicle Management
 * Spec: features/feature-4-vehicle-management.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { optionsPayload } from "../app/vehicles/makeModels.js";
import { syncTestDatabase, signInAs } from "./helpers.js";

const areaA = { areaName: "Athletics", areaLogo: "https://example.org/a.png", noticeEmail: "Athletics desk." };
const areaB = { areaName: "Maintenance", areaLogo: "https://example.org/b.png", noticeEmail: "Shop window." };

const fordTransit = (areaId) => ({
  make: "Ford",
  model: "Transit",
  year: 2022,
  vin: "1FTBR1C80MKA12345",
  purchasedDate: "2022-06-15",
  color: "White",
  passengers: 12,
  plateNumber: "OC-4521",
  plateExpireMonth: 8,
  designatedParking: "Support Central lot, spot B3",
  areaId,
});

const chevyExpress = (areaId) => ({
  make: "Chevrolet",
  model: "Express",
  year: 2021,
  vin: "1GCWGAFG5M1234567",
  purchasedDate: "2021-03-01",
  color: "Blue",
  passengers: 8,
  plateNumber: "OC-1001",
  plateExpireMonth: 4,
  designatedParking: "North lot A1",
  areaId,
});

const vehicleKeys = ["areaId", "color", "designatedParking", "id", "make", "model", "passengers", "plateExpireMonth", "plateNumber", "purchasedDate", "vin", "year"];

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const options = (token) => auth(request(app).get("/vehicle-t6/vehicles/options"), token);
const list = (token) => auth(request(app).get("/vehicle-t6/vehicles"), token);
const create = (token, body) => auth(request(app).post("/vehicle-t6/vehicles"), token).send(body);
const update = (token, id, body) => auth(request(app).put(`/vehicle-t6/vehicles/${id}`), token).send(body);
const remove = (token, id) => auth(request(app).delete(`/vehicle-t6/vehicles/${id}`), token);

const seedAreas = async () => {
  const first = await db.area.create(areaA);
  const second = await db.area.create(areaB);
  return { area1: first.id, area2: second.id };
};

const plain = (row) => vehiclePayload(row);
const vehiclePayload = (row) => ({
  id: row.id,
  make: row.make,
  model: row.model,
  year: row.year,
  vin: row.vin,
  purchasedDate: row.purchasedDate,
  color: row.color,
  passengers: row.passengers,
  plateNumber: row.plateNumber,
  plateExpireMonth: row.plateExpireMonth,
  designatedParking: row.designatedParking,
  areaId: row.areaId,
});
const snapshot = async () => (await db.vehicle.findAll({ order: [["id", "ASC"]] })).map(plain);

beforeEach(async () => {
  await syncTestDatabase();
});
afterAll(async () => { await db.sequelize.close(); });

describe("Feature 4 — Vehicle Management", () => {
  describe("US-4.1 — View vehicles", () => {
    it("Admin lists every vehicle in make and model order", async () => {
      const { area1, area2 } = await seedAreas();
      const express = await db.vehicle.create(chevyExpress(area1));
      const transit = await db.vehicle.create(fordTransit(area2));
      const { token } = await signInAs("admin");
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { ...chevyExpress(area1), id: express.id },
        { ...fordTransit(area2), id: transit.id },
      ]);
      expect(Object.keys(response.body[0]).sort()).toEqual(vehicleKeys);
    });

    it("Area admin lists only vehicles for its area", async () => {
      const { area1, area2 } = await seedAreas();
      await db.vehicle.create(chevyExpress(area1));
      const mine = await db.vehicle.create(fordTransit(area2));
      const { token } = await signInAs("area_admin", { areaId: area2 });
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ ...fordTransit(area2), id: mine.id }]);
    });

    it("Area admin without an assignment gets an empty list", async () => {
      const { area1 } = await seedAreas();
      await db.vehicle.create(chevyExpress(area1));
      const { token } = await signInAs("area_admin", { areaId: null });
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Empty vehicle list is returned", async () => {
      const { token } = await signInAs("admin");
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Requestor and maintenance cannot list vehicles", async () => {
      await seedAreas();
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await list(token);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
    });

    it("Vehicle API requires a session", async () => {
      const { area1 } = await seedAreas();
      const vehicle = await db.vehicle.create(chevyExpress(area1));
      const before = await snapshot();
      const attempts = [
        list(),
        create(undefined, fordTransit(area1)),
        update(undefined, vehicle.id, fordTransit(area1)),
        remove(undefined, vehicle.id),
        options(),
        auth(request(app).get("/vehicle-t6/vehicles"), "not-a-session"),
      ];
      for (const pending of attempts) {
        const response = await pending;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Options returns the standard make and model lists", async () => {
      for (const role of ["admin", "area_admin"]) {
        const { token } = await signInAs(role);
        const response = await options(token);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(optionsPayload());
      }
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await options(token);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
    });
  });

  describe("US-4.2 — Add a vehicle", () => {
    it("Admin creates a vehicle", async () => {
      const { area1 } = await seedAreas();
      const { token } = await signInAs("admin");
      const response = await create(token, fordTransit(area1));
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: expect.any(Number), ...fordTransit(area1) });
      expect(response.body.vin).toBe("1FTBR1C80MKA12345");
      expect(await snapshot()).toEqual([{ id: response.body.id, ...fordTransit(area1) }]);
    });

    it("Area admin creates a vehicle for its own area", async () => {
      const { area2 } = await seedAreas();
      const { token } = await signInAs("area_admin", { areaId: area2 });
      const response = await create(token, fordTransit(area2));
      expect(response.status).toBe(201);
      expect(response.body.areaId).toBe(area2);
      expect(await db.vehicle.count()).toBe(1);
    });

    it("Area admin cannot create a vehicle for another area", async () => {
      const { area1, area2 } = await seedAreas();
      const { token } = await signInAs("area_admin", { areaId: area2 });
      const response = await create(token, fordTransit(area1));
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden." });
      expect(await db.vehicle.count()).toBe(0);
    });

    it("Area admin without an assignment cannot create a vehicle", async () => {
      const { area1 } = await seedAreas();
      const { token } = await signInAs("area_admin", { areaId: null });
      const response = await create(token, fordTransit(area1));
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden." });
      expect(await db.vehicle.count()).toBe(0);
    });

    it("Vehicle string values trim outer spaces", async () => {
      const { area1 } = await seedAreas();
      const { token } = await signInAs("admin");
      const response = await create(token, {
        ...fordTransit(area1),
        vin: "  1ftbr1c80mka12345  ",
        color: "  White  ",
        plateNumber: "  OC-4521  ",
        designatedParking: "  Support Central lot, spot B3  ",
      });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        vin: "1FTBR1C80MKA12345",
        color: "White",
        plateNumber: "OC-4521",
        designatedParking: "Support Central lot, spot B3",
      });
    });

    it("Duplicate VIN is rejected", async () => {
      const { area1, area2 } = await seedAreas();
      await db.vehicle.create(fordTransit(area1));
      const { token } = await signInAs("admin");
      const response = await create(token, { ...chevyExpress(area2), vin: "1ftbr1c80mka12345" });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "VIN is already in use." });
      expect(await db.vehicle.count()).toBe(1);
    });

    it("Unknown make or model is rejected", async () => {
      const { area1 } = await seedAreas();
      const { token } = await signInAs("admin");
      for (const body of [
        { ...fordTransit(area1), make: "Tesla" },
        { ...fordTransit(area1), model: "Mustang" },
        { ...fordTransit(area1), make: "Chevrolet", model: "Transit" },
      ]) {
        const response = await create(token, body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid vehicle data." });
      }
      expect(await db.vehicle.count()).toBe(0);
    });

    it("Missing area is rejected", async () => {
      await seedAreas();
      const { token } = await signInAs("admin");
      const response = await create(token, fordTransit(9999));
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Area with id=9999 not found." });
      expect(await db.vehicle.count()).toBe(0);
    });

    it("Requestor and maintenance cannot create a vehicle", async () => {
      const { area1 } = await seedAreas();
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await create(token, fordTransit(area1));
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await db.vehicle.count()).toBe(0);
    });

    it("Client cannot select a vehicle primary key", async () => {
      const { area1 } = await seedAreas();
      const { token } = await signInAs("admin");
      const response = await create(token, { ...fordTransit(area1), id: 99, extra: "nope", createdAt: "2000-01-01" });
      expect(response.status).toBe(201);
      expect(response.body.id).not.toBe(99);
      expect(Object.keys(response.body).sort()).toEqual(vehicleKeys);
      expect(await db.vehicle.findByPk(99)).toBeNull();
    });
  });

  describe("US-4.3 — Edit a vehicle", () => {
    it("Admin updates a vehicle", async () => {
      const { area1, area2 } = await seedAreas();
      const vehicle = await db.vehicle.create(chevyExpress(area1));
      const { token } = await signInAs("admin");
      const replacement = fordTransit(area2);
      const response = await update(token, vehicle.id, replacement);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: vehicle.id, ...replacement });
      expect(await snapshot()).toEqual([{ id: vehicle.id, ...replacement }]);
    });

    it("Area admin updates a vehicle in its area", async () => {
      const { area2 } = await seedAreas();
      const vehicle = await db.vehicle.create(fordTransit(area2));
      const { token } = await signInAs("area_admin", { areaId: area2 });
      const response = await update(token, vehicle.id, { ...fordTransit(area2), color: "Silver" });
      expect(response.status).toBe(200);
      expect(response.body.color).toBe("Silver");
      expect(response.body.id).toBe(vehicle.id);
    });

    it("Area admin cannot update a vehicle in another area", async () => {
      const { area1, area2 } = await seedAreas();
      const vehicle = await db.vehicle.create(chevyExpress(area1));
      const before = await snapshot();
      const { token } = await signInAs("area_admin", { areaId: area2 });
      const response = await update(token, vehicle.id, fordTransit(area2));
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Vehicle with id=${vehicle.id} not found.` });
      expect(await snapshot()).toEqual(before);
    });

    it("Area admin cannot move a vehicle to another area", async () => {
      const { area1, area2 } = await seedAreas();
      const vehicle = await db.vehicle.create(fordTransit(area2));
      const { token } = await signInAs("area_admin", { areaId: area2 });
      const response = await update(token, vehicle.id, fordTransit(area1));
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden." });
      expect((await db.vehicle.findByPk(vehicle.id)).areaId).toBe(area2);
    });

    it("Updating a missing vehicle is rejected", async () => {
      const { area1 } = await seedAreas();
      const { token } = await signInAs("admin");
      const response = await update(token, 9999, fordTransit(area1));
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Vehicle with id=9999 not found." });
    });

    it("Invalid vehicle route id is rejected", async () => {
      const { area1 } = await seedAreas();
      const { token } = await signInAs("admin");
      for (const id of ["abc", "0", "-1", "9007199254740992"]) {
        for (const call of [() => update(token, id, fordTransit(area1)), () => remove(token, id)]) {
          const response = await call();
          expect(response.status).toBe(400);
          expect(response.body).toEqual({ message: "Vehicle id must be a positive integer." });
        }
      }
    });
  });

  describe("US-4.4 — Delete a vehicle", () => {
    it("Admin deletes an unused vehicle", async () => {
      const { area1 } = await seedAreas();
      const vehicle = await db.vehicle.create(chevyExpress(area1));
      const { token } = await signInAs("admin");
      const response = await remove(token, vehicle.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Vehicle deleted." });
      expect(await db.vehicle.count()).toBe(0);
    });

    it("Area admin deletes an unused vehicle in its area", async () => {
      const { area2 } = await seedAreas();
      const vehicle = await db.vehicle.create(fordTransit(area2));
      const { token } = await signInAs("area_admin", { areaId: area2 });
      const response = await remove(token, vehicle.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Vehicle deleted." });
    });

    it("Area admin cannot delete a vehicle in another area", async () => {
      const { area1, area2 } = await seedAreas();
      const vehicle = await db.vehicle.create(chevyExpress(area1));
      const { token } = await signInAs("area_admin", { areaId: area2 });
      const response = await remove(token, vehicle.id);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Vehicle with id=${vehicle.id} not found.` });
      expect(await db.vehicle.count()).toBe(1);
    });

    it("Deleting a missing vehicle is rejected", async () => {
      const { token } = await signInAs("admin");
      const response = await remove(token, 9999);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Vehicle with id=9999 not found." });
    });
  });
});
