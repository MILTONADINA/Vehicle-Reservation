/**
 * Feature 6 — Destination Management
 * Spec: features/feature-6-destination-management.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { optionsPayload } from "../app/destinations/states.js";
import { syncTestDatabase, signInAs } from "./helpers.js";

const oklahoma = {
  destinationName: "Oklahoma City Airport",
  addressLine: "7100 Terminal Drive",
  city: "Oklahoma City",
  state: "OK",
  zipCode: "73159",
  roundTripMiles: 120.5,
  status: "active",
};

const tulsa = {
  destinationName: "Tulsa Downtown",
  addressLine: "100 South Main Street",
  city: "Tulsa",
  state: "OK",
  zipCode: "74103",
  roundTripMiles: 210,
  status: "active",
};

const destinationKeys = [
  "addressLine",
  "city",
  "destinationName",
  "id",
  "roundTripMiles",
  "state",
  "status",
  "zipCode",
];

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const options = (token) => auth(request(app).get("/vehicle-t6/destinations/options"), token);
const list = (token) => auth(request(app).get("/vehicle-t6/destinations"), token);
const create = (token, body) => auth(request(app).post("/vehicle-t6/destinations"), token).send(body);
const update = (token, id, body) => auth(request(app).put(`/vehicle-t6/destinations/${id}`), token).send(body);
const remove = (token, id) => auth(request(app).delete(`/vehicle-t6/destinations/${id}`), token);

const payload = (row) => ({
  id: row.id,
  destinationName: row.destinationName,
  addressLine: row.addressLine,
  city: row.city,
  state: row.state,
  zipCode: row.zipCode,
  roundTripMiles: Number(row.roundTripMiles),
  status: row.status,
});
const snapshot = async () => (await db.destination.findAll({ order: [["id", "ASC"]] })).map(payload);

beforeEach(async () => {
  await syncTestDatabase();
});
afterAll(async () => { await db.sequelize.close(); });

describe("Feature 6 — Destination Management", () => {
  describe("US-6.1 — View destinations", () => {
    it("Admin lists every destination in name order", async () => {
      const tulsaRow = await db.destination.create(tulsa);
      const oklahomaFirst = await db.destination.create(oklahoma);
      const oklahomaSecond = await db.destination.create({
        ...oklahoma,
        destinationName: "Oklahoma City Airport B",
        addressLine: "7200 Terminal Drive",
      });
      const { token } = await signInAs("admin");
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { ...oklahoma, id: oklahomaFirst.id },
        { ...oklahoma, destinationName: "Oklahoma City Airport B", addressLine: "7200 Terminal Drive", id: oklahomaSecond.id },
        { ...tulsa, id: tulsaRow.id },
      ]);
      expect(Object.keys(response.body[0]).sort()).toEqual(destinationKeys);
    });

    it("Area admin lists every destination", async () => {
      const tulsaRow = await db.destination.create(tulsa);
      const oklahomaRow = await db.destination.create(oklahoma);
      const { token } = await signInAs("area_admin", { areaId: null });
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { ...oklahoma, id: oklahomaRow.id },
        { ...tulsa, id: tulsaRow.id },
      ]);
    });

    it("Requestor and maintenance can read the destination list", async () => {
      const oklahomaRow = await db.destination.create(oklahoma);
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await list(token);
        expect(response.status).toBe(200);
        expect(response.body).toEqual([{ ...oklahoma, id: oklahomaRow.id }]);
      }
    });

    it("Empty destination list is returned", async () => {
      const { token } = await signInAs("admin");
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Destination API requires a session", async () => {
      const destination = await db.destination.create(oklahoma);
      const before = await snapshot();
      const attempts = [
        list(),
        create(undefined, oklahoma),
        update(undefined, destination.id, oklahoma),
        remove(undefined, destination.id),
        options(),
        auth(request(app).get("/vehicle-t6/destinations"), "not-a-session"),
      ];
      for (const pending of attempts) {
        const response = await pending;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Options returns the standard state list", async () => {
      for (const role of ["admin", "area_admin", "requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await options(token);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(optionsPayload());
      }
    });
  });

  describe("US-6.2 — Add a destination", () => {
    it("Admin creates a destination", async () => {
      const { token } = await signInAs("admin");
      const response = await create(token, oklahoma);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject(oklahoma);
      expect(Number.isInteger(response.body.id)).toBe(true);
      expect(response.body.state).toBe("OK");
      expect(response.body.roundTripMiles).toBe(120.5);
      expect(Object.keys(response.body).sort()).toEqual(destinationKeys);
    });

    it("Area admin creates a destination", async () => {
      const { token } = await signInAs("area_admin");
      const response = await create(token, tulsa);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject(tulsa);
    });

    it("Destination values trim outer spaces", async () => {
      const { token } = await signInAs("admin");
      const response = await create(token, {
        ...oklahoma,
        destinationName: "  Oklahoma City Airport  ",
        addressLine: "  7100 Terminal Drive  ",
        city: "  Oklahoma City  ",
        state: "  ok  ",
        zipCode: "  73159  ",
      });
      expect(response.status).toBe(201);
      expect(response.body.destinationName).toBe("Oklahoma City Airport");
      expect(response.body.addressLine).toBe("7100 Terminal Drive");
      expect(response.body.city).toBe("Oklahoma City");
      expect(response.body.state).toBe("OK");
      expect(response.body.zipCode).toBe("73159");
    });

    it("Duplicate destination name is rejected", async () => {
      await db.destination.create(oklahoma);
      const { token } = await signInAs("admin");
      const response = await create(token, { ...tulsa, destinationName: "oklahoma city airport" });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Destination name is already in use." });
      expect(await snapshot()).toHaveLength(1);
    });

    it("Unknown state is rejected", async () => {
      const { token } = await signInAs("admin");
      for (const state of ["XX", "Oklahoma", "O"]) {
        const response = await create(token, { ...oklahoma, state });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid destination data." });
      }
      expect(await snapshot()).toEqual([]);
    });

    it("Invalid zip code is rejected", async () => {
      const { token } = await signInAs("admin");
      for (const zipCode of ["7315", "731590", "73A59"]) {
        const response = await create(token, { ...oklahoma, zipCode });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid destination data." });
      }
      expect(await snapshot()).toEqual([]);
    });

    it("Invalid destination status is rejected", async () => {
      const { token } = await signInAs("admin");
      for (const status of ["pending", ""]) {
        const response = await create(token, { ...oklahoma, status });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid destination data." });
      }
      expect(await snapshot()).toEqual([]);
    });

    it("Invalid destination round-trip miles are rejected", async () => {
      const { token } = await signInAs("admin");
      for (const roundTripMiles of [0, -1, 10000, 12.34]) {
        const response = await create(token, { ...oklahoma, roundTripMiles });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid destination data." });
      }
      expect(await snapshot()).toEqual([]);
    });

    it("Requestor and maintenance cannot create a destination", async () => {
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await create(token, oklahoma);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await snapshot()).toEqual([]);
    });

    it("Client cannot select a destination primary key", async () => {
      const { token } = await signInAs("admin");
      const response = await create(token, { ...oklahoma, id: 99, extra: "ignore-me" });
      expect(response.status).toBe(201);
      expect(response.body.id).not.toBe(99);
      expect(response.body).not.toHaveProperty("extra");
      expect(Object.keys(response.body).sort()).toEqual(destinationKeys);
    });
  });

  describe("US-6.3 — Edit a destination", () => {
    it("Admin updates a destination", async () => {
      const destination = await db.destination.create(oklahoma);
      const { token } = await signInAs("admin");
      const body = { ...tulsa, status: "active" };
      const response = await update(token, destination.id, body);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...body, id: destination.id });
    });

    it("Area admin updates a destination", async () => {
      const destination = await db.destination.create(oklahoma);
      const { token } = await signInAs("area_admin");
      const body = { ...oklahoma, city: "Midwest City" };
      const response = await update(token, destination.id, body);
      expect(response.status).toBe(200);
      expect(response.body.city).toBe("Midwest City");
      expect(response.body.id).toBe(destination.id);
    });

    it("Admin can set a destination inactive", async () => {
      const destination = await db.destination.create(oklahoma);
      const { token } = await signInAs("admin");
      const response = await update(token, destination.id, { ...oklahoma, status: "inactive" });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("inactive");
    });

    it("Updating to a duplicate destination name is rejected", async () => {
      await db.destination.create(oklahoma);
      const tulsaRow = await db.destination.create(tulsa);
      const before = await snapshot();
      const { token } = await signInAs("admin");
      const response = await update(token, tulsaRow.id, {
        ...tulsa,
        destinationName: "oklahoma city airport",
      });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Destination name is already in use." });
      expect(await snapshot()).toEqual(before);
    });

    it("Unchanged destination name can be saved", async () => {
      const destination = await db.destination.create(oklahoma);
      const { token } = await signInAs("admin");
      const response = await update(token, destination.id, {
        ...oklahoma,
        addressLine: "7110 Terminal Drive",
      });
      expect(response.status).toBe(200);
      expect(response.body.destinationName).toBe("Oklahoma City Airport");
      expect(response.body.addressLine).toBe("7110 Terminal Drive");
    });

    it("Requestor and maintenance cannot update a destination", async () => {
      const destination = await db.destination.create(oklahoma);
      const before = await snapshot();
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await update(token, destination.id, tulsa);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Updating a missing destination is rejected", async () => {
      const { token } = await signInAs("admin");
      const response = await update(token, 9999, oklahoma);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Destination with id=9999 not found." });
    });

    it("Invalid destination route id is rejected", async () => {
      const { token } = await signInAs("admin");
      for (const id of ["abc", "0", "-1", "9007199254740992"]) {
        for (const verb of [
          () => update(token, id, oklahoma),
          () => remove(token, id),
        ]) {
          const response = await verb();
          expect(response.status).toBe(400);
          expect(response.body).toEqual({ message: "Destination id must be a positive integer." });
        }
      }
    });
  });

  describe("US-6.4 — Delete a destination", () => {
    it("Admin deletes a destination", async () => {
      const destination = await db.destination.create(oklahoma);
      const { token } = await signInAs("admin");
      const response = await remove(token, destination.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Destination deleted." });
      expect(await snapshot()).toEqual([]);
    });

    it("Area admin deletes a destination", async () => {
      const destination = await db.destination.create(oklahoma);
      const { token } = await signInAs("area_admin");
      const response = await remove(token, destination.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Destination deleted." });
    });

    it("Requestor and maintenance cannot delete a destination", async () => {
      const destination = await db.destination.create(oklahoma);
      const before = await snapshot();
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await remove(token, destination.id);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Deleting a missing destination is rejected", async () => {
      const { token } = await signInAs("admin");
      const response = await remove(token, 9999);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Destination with id=9999 not found." });
    });
  });
});
