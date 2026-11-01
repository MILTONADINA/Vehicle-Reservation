/**
 * Feature 2 — Area Management
 * Spec: features/feature-2-area-management.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { authenticate } from "../app/authorization/authorization.js";
import { googleVerifier } from "../app/authorization/googleVerifier.js";
import { syncTestDatabase, createUser, createSession, signInAs } from "./helpers.js";

const athletics = {
  areaName: "Athletics",
  areaLogo: "https://example.org/logo.png",
  noticeEmail: "Collect keys from Athletics. Return the vehicle clean with a full tank.",
};
const maintenance = { areaName: "Maintenance", areaLogo: "https://example.org/maintenance.png", noticeEmail: "Pick up at the shop." };
const replacement = { areaName: "Campus Events", areaLogo: "https://example.org/events.png", noticeEmail: "Keys at the events office." };
const areaShape = { id: expect.any(Number), areaName: expect.any(String), areaLogo: expect.any(String), noticeEmail: expect.any(String) };

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const list = (token) => auth(request(app).get("/vehicle-t6/areas"), token);
const create = (token, body) => auth(request(app).post("/vehicle-t6/areas"), token).send(body);
const update = (token, id, body) => auth(request(app).put(`/vehicle-t6/areas/${id}`), token).send(body);
const remove = (token, id) => auth(request(app).delete(`/vehicle-t6/areas/${id}`), token);

// A test-only route exposing the authenticated request context.
app.get("/vehicle-t6/test-only/context", authenticate, (req, res) => res.send(req.user));

const seedAreas = async () => {
  const first = await db.area.create(maintenance);
  const second = await db.area.create(athletics);
  return { maintenanceId: first.id, athleticsId: second.id };
};
const plain = (row) => ({ id: row.id, areaName: row.areaName, areaLogo: row.areaLogo, noticeEmail: row.noticeEmail });
const snapshot = async () => (await db.area.findAll({ order: [["id", "ASC"]] })).map(plain);

beforeEach(async () => {
  await syncTestDatabase();
});
afterAll(async () => { await db.sequelize.close(); });

describe("Feature 2 — Area Management", () => {
  describe("US-2.1 — View areas", () => {
    it("Admin lists every area in name order", async () => {
      const { maintenanceId, athleticsId } = await seedAreas();
      const { token } = await signInAs("admin");
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: athleticsId, ...athletics },
        { id: maintenanceId, ...maintenance },
      ]);
      expect(Object.keys(response.body[0]).sort()).toEqual(["areaLogo", "areaName", "id", "noticeEmail"]);
    });

    it("Area admin lists every area", async () => {
      const { athleticsId } = await seedAreas();
      const { token } = await signInAs("area_admin", { areaId: athleticsId });
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body.map((area) => area.areaName)).toEqual(["Athletics", "Maintenance"]);
    });

    it("Area admin without an assignment still lists every area", async () => {
      const { athleticsId } = await seedAreas();
      const { token } = await signInAs("area_admin", { areaId: null });
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      const edit = await update(token, athleticsId, replacement);
      expect(edit.status).toBe(404);
    });

    it("Requestor and maintenance users can read the area list", async () => {
      await seedAreas();
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await list(token);
        expect(response.status).toBe(200);
        expect(response.body.map((area) => area.areaName)).toEqual(["Athletics", "Maintenance"]);
        expect((await create(token, replacement)).status).toBe(403);
      }
      expect(await db.area.count()).toBe(2);
    });

    it("Empty area list is returned", async () => {
      const { token } = await signInAs("admin");
      const response = await list(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("Area API requires a session", async () => {
      const { athleticsId } = await seedAreas();
      const before = await snapshot();
      const attempts = [
        list(),
        create(undefined, replacement),
        update(undefined, athleticsId, replacement),
        remove(undefined, athleticsId),
        auth(request(app).get("/vehicle-t6/areas"), "not-a-session"),
      ];
      for (const pending of attempts) {
        const response = await pending;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Account session exposes its current area assignment", async () => {
      const { athleticsId } = await seedAreas();
      const user = await createUser({ role: "area_admin", areaId: athleticsId, googleSub: "google-sub-area-admin", email: "area.admin@oc.edu", firstName: "Ari", lastName: "Dale" });
      const previousVerify = googleVerifier.verifyIdToken;
      googleVerifier.verifyIdToken = jest.fn(async () => ({
        sub: "google-sub-area-admin", email: "area.admin@oc.edu", email_verified: true, hd: "oc.edu", given_name: "Ari", family_name: "Dale",
      }));
      try {
        const login = await request(app).post("/vehicle-t6/login").send({ credential: "google-id-token" });
        expect(login.status).toBe(200);
        expect(login.body).toEqual({ userId: user.id, email: "area.admin@oc.edu", firstName: "Ari", lastName: "Dale", role: "area_admin", areaId: athleticsId, token: expect.any(String) });
        const me = await auth(request(app).get("/vehicle-t6/auth/me"), login.body.token);
        expect(me.body).toEqual({ userId: user.id, email: "area.admin@oc.edu", firstName: "Ari", lastName: "Dale", role: "area_admin", areaId: athleticsId });
        const context = await auth(request(app).get("/vehicle-t6/test-only/context?areaId=1&role=admin"), login.body.token).send({ areaId: 1, role: "admin" });
        expect(context.status).toBe(200);
        expect(context.body).toEqual({ id: user.id, role: "area_admin", areaId: athleticsId });
      } finally {
        googleVerifier.verifyIdToken = previousVerify;
      }
    });
  });

  describe("US-2.2 — Create an area", () => {
    it("Admin creates an area", async () => {
      const { token } = await signInAs("admin");
      const response = await create(token, athletics);
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: expect.any(Number), ...athletics });
      expect(await snapshot()).toEqual([{ id: response.body.id, ...athletics }]);
      // Saving reminder text is a plain write: no email module is part of this feature.
      expect(Object.keys(db).some((key) => /mail|email/i.test(key))).toBe(false);
    });

    it("Area values are trimmed without changing their meaning", async () => {
      const { token } = await signInAs("admin");
      const response = await create(token, {
        areaName: "  Campus Events  ",
        areaLogo: "  https://example.org/Events.png  ",
        noticeEmail: "  Collect KEYS  at  the desk.\nReturn the van CLEAN.\n\nThanks!  ",
      });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        areaName: "Campus Events",
        areaLogo: "https://example.org/Events.png",
        noticeEmail: "Collect KEYS  at  the desk.\nReturn the van CLEAN.\n\nThanks!",
      });
      expect((await db.area.findByPk(response.body.id)).noticeEmail).toBe("Collect KEYS  at  the desk.\nReturn the van CLEAN.\n\nThanks!");
    });

    it("Duplicate area name is rejected", async () => {
      await db.area.create(athletics);
      const { token } = await signInAs("admin");
      for (const areaName of ["athletics", "  Athletics ", "ATHLETICS"]) {
        const response = await create(token, { ...replacement, areaName });
        expect(response.status).toBe(409);
        expect(response.body).toEqual({ message: "Area name is already in use." });
      }
      expect(await db.area.count()).toBe(1);
      // Uniqueness ignores case and surrounding spaces only: a differently spelled name is a new area.
      const accented = await create(token, { ...replacement, areaName: "Athlétics" });
      expect(accented.status).toBe(201);
      expect(await db.area.count()).toBe(2);
    });

    it("Non-admin cannot create an area", async () => {
      for (const role of ["area_admin", "requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await create(token, athletics);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await db.area.count()).toBe(0);
    });

    it("Client cannot select an area primary key", async () => {
      const { token } = await signInAs("admin");
      const response = await create(token, { ...athletics, id: 99, color: "maroon", createdAt: "2000-01-01" });
      expect(response.status).toBe(201);
      expect(response.body.id).not.toBe(99);
      expect(Object.keys(response.body).sort()).toEqual(["areaLogo", "areaName", "id", "noticeEmail"]);
      const stored = await db.area.findByPk(response.body.id);
      expect(stored).not.toBeNull();
      expect(stored.get({ plain: true })).not.toHaveProperty("color");
      expect(await db.area.findByPk(99)).toBeNull();
    });

    it("Area areaName rejects invalid values", async () => {
      const { token } = await signInAs("admin");
      const existing = await db.area.create(maintenance);
      const invalid = [undefined, null, 123, "", "   ", "a".repeat(101)];
      for (const areaName of invalid) {
        const body = { ...athletics };
        if (areaName === undefined) delete body.areaName; else body.areaName = areaName;
        const posted = await create(token, body);
        expect(posted.status).toBe(400);
        expect(posted.body).toEqual({ message: "Invalid area data." });
        const put = await update(token, existing.id, body);
        expect(put.status).toBe(400);
        expect(put.body).toEqual({ message: "Invalid area data." });
      }
      expect(await snapshot()).toEqual([plain(existing)]);
    });

    it("Area areaLogo rejects invalid values", async () => {
      const { token } = await signInAs("admin");
      const existing = await db.area.create(maintenance);
      const invalid = [
        undefined, null, 5, "", "   ", `https://example.org/${"x".repeat(2049)}`,
        "http://example.org/logo.png", "ftp://example.org/logo.png", "not a url", "https://", "example.org/logo.png", "javascript:alert(1)",
      ];
      for (const areaLogo of invalid) {
        const body = { ...athletics };
        if (areaLogo === undefined) delete body.areaLogo; else body.areaLogo = areaLogo;
        const posted = await create(token, body);
        expect(posted.status).toBe(400);
        expect(posted.body).toEqual({ message: "Invalid area data." });
        const put = await update(token, existing.id, body);
        expect(put.status).toBe(400);
        expect(put.body).toEqual({ message: "Invalid area data." });
      }
      expect(await snapshot()).toEqual([plain(existing)]);
    });

    it("Area reminder text rejects invalid values", async () => {
      const { token } = await signInAs("admin");
      const existing = await db.area.create(maintenance);
      const invalid = [undefined, null, 7, "", "   \n  ", "x".repeat(5001)];
      for (const noticeEmail of invalid) {
        const body = { ...athletics };
        if (noticeEmail === undefined) delete body.noticeEmail; else body.noticeEmail = noticeEmail;
        const posted = await create(token, body);
        expect(posted.status).toBe(400);
        expect(posted.body).toEqual({ message: "Invalid area data." });
        const put = await update(token, existing.id, body);
        expect(put.status).toBe(400);
        expect(put.body).toEqual({ message: "Invalid area data." });
      }
      expect(await snapshot()).toEqual([plain(existing)]);
      const longest = await create(token, { ...athletics, noticeEmail: "y".repeat(5000) });
      expect(longest.status).toBe(201);
    });
  });

  describe("US-2.3 — Update an area", () => {
    it("Area edit scope comes from the database", async () => {
      const { maintenanceId, athleticsId } = await seedAreas();
      const { token } = await signInAs("area_admin", { areaId: athleticsId });
      const response = await auth(request(app).put(`/vehicle-t6/areas/${athleticsId}?areaId=${maintenanceId}`), token)
        .send({ ...replacement, areaId: maintenanceId, role: "admin", id: maintenanceId });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: athleticsId, ...replacement });
      expect(plain(await db.area.findByPk(maintenanceId))).toEqual({ id: maintenanceId, ...maintenance });
      expect(plain(await db.area.findByPk(athleticsId))).toEqual({ id: athleticsId, ...replacement });
    });

    it("Admin updates any area", async () => {
      const { athleticsId } = await seedAreas();
      const { token } = await signInAs("admin");
      const response = await update(token, athleticsId, replacement);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: athleticsId, ...replacement });
      expect(plain(await db.area.findByPk(athleticsId))).toEqual({ id: athleticsId, ...replacement });
      expect(Object.keys(db).some((key) => /mail|email/i.test(key))).toBe(false);
    });

    it("Area admin updates the assigned area", async () => {
      const { maintenanceId, athleticsId } = await seedAreas();
      const { token } = await signInAs("area_admin", { areaId: athleticsId });
      const response = await update(token, athleticsId, replacement);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: athleticsId, ...replacement });
      expect(plain(await db.area.findByPk(maintenanceId))).toEqual({ id: maintenanceId, ...maintenance });
    });

    it("Area admin cannot update another area", async () => {
      const { maintenanceId, athleticsId } = await seedAreas();
      const before = await snapshot();
      const { token } = await signInAs("area_admin", { areaId: athleticsId });
      const response = await update(token, maintenanceId, replacement);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Area with id=${maintenanceId} not found.` });
      expect(await snapshot()).toEqual(before);
    });

    it("Area admin without an area cannot edit a record", async () => {
      const { athleticsId } = await seedAreas();
      const before = await snapshot();
      const { token } = await signInAs("area_admin", { areaId: null });
      const response = await update(token, athleticsId, replacement);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: `Area with id=${athleticsId} not found.` });
      expect(await snapshot()).toEqual(before);
    });

    it("Read-only roles cannot update an area", async () => {
      const { athleticsId } = await seedAreas();
      const before = await snapshot();
      for (const role of ["requestor", "maintenance"]) {
        const { token } = await signInAs(role);
        const response = await update(token, athleticsId, replacement);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Updating to a duplicate name is rejected", async () => {
      const { maintenanceId } = await seedAreas();
      const before = await snapshot();
      const { token } = await signInAs("admin");
      const response = await update(token, maintenanceId, { ...maintenance, areaName: "athletics" });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Area name is already in use." });
      expect(await snapshot()).toEqual(before);
    });

    it("Unchanged area name can be saved", async () => {
      const { athleticsId } = await seedAreas();
      for (const role of [["admin", {}], ["area_admin", { areaId: athleticsId }]]) {
        const { token } = await signInAs(role[0], role[1]);
        const response = await update(token, athleticsId, { ...athletics, noticeEmail: `Updated by ${role[0]}.` });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: athleticsId, ...athletics, noticeEmail: `Updated by ${role[0]}.` });
      }
    });

    it("Invalid area IDs are rejected", async () => {
      await seedAreas();
      const before = await snapshot();
      const { token } = await signInAs("admin");
      for (const id of ["abc", "0", "-1", "1.5", "12abc", "9007199254740993", "1e3", " 1"]) {
        const put = await update(token, id, replacement);
        expect(put.status).toBe(400);
        expect(put.body).toEqual({ message: "Area id must be a positive integer." });
        const del = await remove(token, id);
        expect(del.status).toBe(400);
        expect(del.body).toEqual({ message: "Area id must be a positive integer." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Missing area IDs return not found", async () => {
      await seedAreas();
      const { token } = await signInAs("admin");
      const put = await update(token, 999, replacement);
      expect(put.status).toBe(404);
      expect(put.body).toEqual({ message: "Area with id=999 not found." });
      const del = await remove(token, 999);
      expect(del.status).toBe(404);
      expect(del.body).toEqual({ message: "Area with id=999 not found." });
      expect(await db.area.count()).toBe(2);
    });

    it("Area storage failures return a safe error", async () => {
      const { athleticsId } = await seedAreas();
      const before = await snapshot();
      const { token } = await signInAs("admin");
      const failures = [
        [jest.spyOn(db.area, "findAll").mockRejectedValueOnce(new Error("connection lost")), () => list(token)],
        [jest.spyOn(db.area, "create").mockRejectedValueOnce(new Error("connection lost")), () => create(token, replacement)],
        [jest.spyOn(db.area.prototype, "update").mockRejectedValueOnce(new Error("connection lost")), () => update(token, athleticsId, replacement)],
        [jest.spyOn(db.area.prototype, "destroy").mockRejectedValueOnce(new Error("connection lost")), () => remove(token, athleticsId)],
      ];
      for (const [spy, run] of failures) {
        const response = await run();
        spy.mockRestore();
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ message: "Area request failed." });
      }
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("US-2.4 — Delete an unused area", () => {
    it("Admin deletes an unused area", async () => {
      const { maintenanceId, athleticsId } = await seedAreas();
      const { token } = await signInAs("admin");
      const response = await remove(token, athleticsId);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Area deleted." });
      const after = await list(token);
      expect(after.body.map((area) => area.id)).toEqual([maintenanceId]);
    });

    it("Area with assigned users cannot be deleted", async () => {
      const { athleticsId } = await seedAreas();
      const assigned = await createUser({ role: "area_admin", areaId: athleticsId });
      const { token } = await signInAs("admin");
      const response = await remove(token, athleticsId);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Area is in use." });
      expect(await db.area.findByPk(athleticsId)).not.toBeNull();
      expect((await db.user.findByPk(assigned.id)).areaId).toBe(athleticsId);
    });

    it("Non-admin cannot delete an area", async () => {
      const { athleticsId } = await seedAreas();
      for (const role of ["area_admin", "requestor", "maintenance"]) {
        const { token } = await signInAs(role, role === "area_admin" ? { areaId: athleticsId } : {});
        const response = await remove(token, athleticsId);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await db.area.count()).toBe(2);
    });
  });
});
