/**
 * Feature 5 — Driver Management
 * Spec: features/feature-5-driver-management.md
 */
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { optionsPayload } from "../app/drivers/licenseStates.js";
import { syncTestDatabase, signInAs } from "./helpers.js";

const jordan = {
  firstName: "Jordan",
  lastName: "Lee",
  licenseState: "OK",
  licenseExpireDate: "2028-06-30",
  approvedDate: "2026-01-15",
  status: "approved",
};

const avery = {
  firstName: "Avery",
  lastName: "Smith",
  licenseState: "TX",
  licenseExpireDate: "2027-12-01",
  approvedDate: "2025-08-20",
  status: "approved",
};

const driverKeys = ["approvedDate", "firstName", "id", "lastName", "licenseExpireDate", "licenseState", "status"];

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const options = (token) => auth(request(app).get("/vehicle-t6/drivers/options"), token);
const list = (token) => auth(request(app).get("/vehicle-t6/drivers"), token);
const create = (token, body) => auth(request(app).post("/vehicle-t6/drivers"), token).send(body);
const update = (token, id, body) => auth(request(app).put(`/vehicle-t6/drivers/${id}`), token).send(body);
const remove = (token, id) => auth(request(app).delete(`/vehicle-t6/drivers/${id}`), token);

const payload = (row) => ({
  id: row.id,
  firstName: row.firstName,
  lastName: row.lastName,
  licenseState: row.licenseState,
  licenseExpireDate: row.licenseExpireDate,
  approvedDate: row.approvedDate,
  status: row.status,
});
const snapshot = async () => (await db.driver.findAll({ order: [["id", "ASC"]] })).map(payload);

beforeEach(async () => {
  await syncTestDatabase();
});
afterAll(async () => { await db.sequelize.close(); });

describe("Feature 5 — Driver Management", () => {
  describe("US-5.1 — View drivers", () => {
    it("Admin lists every driver in name order", async () => {
      const smith = await db.driver.create(avery);
      const lee = await db.driver.create(jordan);
      const { token } = await signInAs("admin");
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { ...jordan, id: lee.id },
        { ...avery, id: smith.id },
      ]);
      expect(Object.keys(response.body[0]).sort()).toEqual(driverKeys);
    });

    it("Area admin lists every driver", async () => {
      const smith = await db.driver.create(avery);
      const lee = await db.driver.create(jordan);
      const { token } = await signInAs("area_admin", { areaId: null });
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { ...jordan, id: lee.id },
        { ...avery, id: smith.id },
      ]);
    });

    it("Requestor and maintenance can read the driver list", async () => {
      const lee = await db.driver.create(jordan);
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await list(token);
        expect(response.status).toBe(200);
        expect(response.body).toEqual([{ ...jordan, id: lee.id }]);
      }
    });

    it("Empty driver list is returned", async () => {
      const { token } = await signInAs("admin");
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Driver API requires a session", async () => {
      const driver = await db.driver.create(jordan);
      const before = await snapshot();
      const attempts = [
        list(),
        create(undefined, jordan),
        update(undefined, driver.id, jordan),
        remove(undefined, driver.id),
        options(),
        auth(request(app).get("/vehicle-t6/drivers"), "not-a-session"),
      ];
      for (const pending of attempts) {
        const response = await pending;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Options returns the standard license-state list", async () => {
      for (const role of ["admin", "area_admin", "requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await options(token);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(optionsPayload());
      }
    });
  });

  describe("US-5.2 — Add a driver", () => {
    it("Admin creates a driver", async () => {
      const { token } = await signInAs("admin");
      const response = await create(token, jordan);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject(jordan);
      expect(Number.isInteger(response.body.id)).toBe(true);
      expect(response.body.licenseState).toBe("OK");
      expect(Object.keys(response.body).sort()).toEqual(driverKeys);
    });

    it("Area admin creates a driver", async () => {
      const { token } = await signInAs("area_admin");
      const response = await create(token, avery);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject(avery);
    });

    it("Driver string values trim outer spaces", async () => {
      const { token } = await signInAs("admin");
      const response = await create(token, {
        ...jordan,
        firstName: "  Jordan  ",
        lastName: "  Lee  ",
        licenseState: "  ok  ",
      });
      expect(response.status).toBe(201);
      expect(response.body.firstName).toBe("Jordan");
      expect(response.body.lastName).toBe("Lee");
      expect(response.body.licenseState).toBe("OK");
    });

    it("Unknown license state is rejected", async () => {
      const { token } = await signInAs("admin");
      for (const licenseState of ["XX", "Oklahoma", "O"]) {
        const response = await create(token, { ...jordan, licenseState });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid driver data." });
      }
      expect(await snapshot()).toEqual([]);
    });

    it("Invalid status is rejected", async () => {
      const { token } = await signInAs("admin");
      for (const status of ["pending", ""]) {
        const response = await create(token, { ...jordan, status });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid driver data." });
      }
      expect(await snapshot()).toEqual([]);
    });

    it("Invalid dates are rejected", async () => {
      const { token } = await signInAs("admin");
      for (const body of [
        { ...jordan, licenseExpireDate: "06-30-2028" },
        { ...jordan, approvedDate: "2026/01/15" },
        { ...jordan, licenseExpireDate: "2028-13-01" },
      ]) {
        const response = await create(token, body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid driver data." });
      }
      expect(await snapshot()).toEqual([]);
    });

    it("Past license expire date can still be saved", async () => {
      const { token } = await signInAs("admin");
      const body = { ...jordan, licenseExpireDate: "2020-01-01", status: "approved" };
      const response = await create(token, body);
      expect(response.status).toBe(201);
      expect(response.body.licenseExpireDate).toBe("2020-01-01");
      expect(response.body.status).toBe("approved");
    });

    it("Requestor and maintenance cannot create a driver", async () => {
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await create(token, jordan);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await snapshot()).toEqual([]);
    });

    it("Client cannot select a driver primary key", async () => {
      const { token } = await signInAs("admin");
      const response = await create(token, { ...jordan, id: 99, extra: "ignore-me" });
      expect(response.status).toBe(201);
      expect(response.body.id).not.toBe(99);
      expect(response.body).not.toHaveProperty("extra");
      expect(Object.keys(response.body).sort()).toEqual(driverKeys);
    });
  });

  describe("US-5.3 — Edit a driver", () => {
    it("Admin updates a driver", async () => {
      const driver = await db.driver.create(jordan);
      const { token } = await signInAs("admin");
      const body = { ...avery, status: "approved" };
      const response = await update(token, driver.id, body);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...body, id: driver.id });
    });

    it("Area admin updates a driver", async () => {
      const driver = await db.driver.create(jordan);
      const { token } = await signInAs("area_admin");
      const body = { ...jordan, firstName: "Jamie" };
      const response = await update(token, driver.id, body);
      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe("Jamie");
      expect(response.body.id).toBe(driver.id);
    });

    it("Admin can set a driver inactive", async () => {
      const driver = await db.driver.create(jordan);
      const { token } = await signInAs("admin");
      const response = await update(token, driver.id, { ...jordan, status: "inactive" });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("inactive");
    });

    it("Requestor and maintenance cannot update a driver", async () => {
      const driver = await db.driver.create(jordan);
      const before = await snapshot();
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await update(token, driver.id, avery);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Updating a missing driver is rejected", async () => {
      const { token } = await signInAs("admin");
      const response = await update(token, 9999, jordan);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Driver with id=9999 not found." });
    });

    it("Invalid driver route id is rejected", async () => {
      const { token } = await signInAs("admin");
      for (const id of ["abc", "0", "-1", "9007199254740992"]) {
        for (const verb of [
          () => update(token, id, jordan),
          () => remove(token, id),
        ]) {
          const response = await verb();
          expect(response.status).toBe(400);
          expect(response.body).toEqual({ message: "Driver id must be a positive integer." });
        }
      }
    });
  });

  describe("US-5.4 — Delete a driver", () => {
    it("Admin deletes a driver", async () => {
      const driver = await db.driver.create(jordan);
      const { token } = await signInAs("admin");
      const response = await remove(token, driver.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Driver deleted." });
      expect(await snapshot()).toEqual([]);
    });

    it("Area admin deletes a driver", async () => {
      const driver = await db.driver.create(jordan);
      const { token } = await signInAs("area_admin");
      const response = await remove(token, driver.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Driver deleted." });
    });

    it("Requestor and maintenance cannot delete a driver", async () => {
      const driver = await db.driver.create(jordan);
      const before = await snapshot();
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await remove(token, driver.id);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Deleting a missing driver is rejected", async () => {
      const { token } = await signInAs("admin");
      const response = await remove(token, 9999);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Driver with id=9999 not found." });
    });
  });
});
