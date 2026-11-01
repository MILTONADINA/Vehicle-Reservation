/**
 * Feature 3 — User Management
 * Spec: features/feature-3-user-management.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { googleVerifier } from "../app/authorization/googleVerifier.js";
import { syncTestDatabase, createUser, createSession, signInAs } from "./helpers.js";

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
const list = (token) => auth(request(app).get("/vehicle-t6/users"), token);
const create = (token, body) => auth(request(app).post("/vehicle-t6/users"), token).send(body);
const update = (token, id, body) => auth(request(app).put(`/vehicle-t6/users/${id}`), token).send(body);
const remove = (token, id) => auth(request(app).delete(`/vehicle-t6/users/${id}`), token);
const me = (token) => auth(request(app).get("/vehicle-t6/auth/me"), token);

const PUBLIC_KEYS = ["areaId", "email", "firstName", "id", "lastName", "role"];
const publicRecord = (user) => ({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, areaId: user.areaId ?? null });
const stored = async (id) => {
  const user = await db.user.findByPk(id);
  return user ? { ...publicRecord(user), googleSub: user.googleSub } : null;
};
const snapshot = async () => (await db.user.findAll({ order: [["id", "ASC"]] })).map((user) => ({ ...publicRecord(user), googleSub: user.googleSub }));
const sessionsOf = (userId) => db.session.count({ where: { userId } });

const validNew = { email: "avery.reed@oc.edu", firstName: "Avery", lastName: "Reed", role: "requestor", areaId: null };
const replacement = { firstName: "Blake", lastName: "Ortiz", role: "maintenance", areaId: null };
const omit = (object, key) => { const copy = { ...object }; delete copy[key]; return copy; };

// Two areas and the four kinds of accounts most scenarios need.
async function seed() {
  const area1 = await db.area.create({ areaName: "Athletics", areaLogo: "https://example.org/a.png", noticeEmail: "Keys at Athletics." });
  const area2 = await db.area.create({ areaName: "Maintenance", areaLogo: "https://example.org/m.png", noticeEmail: "Keys at the shop." });
  const admin = await signInAs("admin", { email: "admin@oc.edu", firstName: "Dana", lastName: "Admin" });
  const areaAdmin1 = await createUser({ role: "area_admin", areaId: area1.id, email: "one@oc.edu", firstName: "Ari", lastName: "One" });
  const areaAdmin2 = await signInAs("area_admin", { areaId: area2.id, email: "two@oc.edu", firstName: "Bo", lastName: "Two" });
  const requestor = await createUser({ role: "requestor", email: "req@oc.edu", firstName: "Casey", lastName: "Req" });
  const maintenance = await createUser({ role: "maintenance", email: "fix@oc.edu", firstName: "Drew", lastName: "Fix" });
  return { area1, area2, admin, areaAdmin1, areaAdmin2, requestor, maintenance };
}

const stubGoogle = (payload) => { googleVerifier.verifyIdToken = jest.fn(async () => payload); };
const realVerify = googleVerifier.verifyIdToken;

beforeEach(async () => {
  await syncTestDatabase();
  googleVerifier.verifyIdToken = realVerify;
});
afterAll(async () => { await db.sequelize.close(); });

describe("Feature 3 — User Management", () => {
  describe("US-3.1 — View users", () => {
    it("Admin lists all users", async () => {
      const { admin, area1 } = await seed();
      // Equal last names order by first name, then by id.
      const bea = await createUser({ email: "bea.zed@oc.edu", firstName: "Bea", lastName: "Zed" });
      const alFirst = await createUser({ email: "al.zed.1@oc.edu", firstName: "Al", lastName: "Zed" });
      const alSecond = await createUser({ email: "al.zed.2@oc.edu", firstName: "Al", lastName: "Zed" });
      const response = await list(admin.token);
      expect(response.status).toBe(200);
      expect(response.body.map((user) => user.lastName)).toEqual(["Admin", "Fix", "One", "Req", "Two", "Zed", "Zed", "Zed"]);
      expect(response.body.slice(-3).map((user) => user.id)).toEqual([alFirst.id, alSecond.id, bea.id]);
      for (const record of response.body) expect(Object.keys(record).sort()).toEqual(PUBLIC_KEYS);
      expect(response.body.find((user) => user.lastName === "One").areaId).toBe(area1.id);
      expect(response.body.find((user) => user.lastName === "Req").areaId).toBeNull();
    });

    it("Area admin lists all users", async () => {
      const { areaAdmin2, area2 } = await seed();
      await createUser({ role: "area_admin", areaId: area2.id, email: "three@oc.edu", firstName: "Cy", lastName: "Three" });
      const response = await list(areaAdmin2.token);
      expect(response.status).toBe(200);
      expect(response.body.map((user) => user.email).sort()).toEqual(["admin@oc.edu", "fix@oc.edu", "one@oc.edu", "req@oc.edu", "three@oc.edu", "two@oc.edu"]);
      expect(new Set(response.body.map((user) => user.role))).toEqual(new Set(["admin", "area_admin", "requestor", "maintenance"]));
    });

    it("Requestor and maintenance cannot manage users", async () => {
      const { requestor } = await seed();
      const before = await snapshot();
      const callers = [];
      for (const role of ["requestor", "maintenance"]) {
        const { user, token } = await signInAs(role);
        callers.push(user.id);
        const attempts = [list(token), create(token, validNew), update(token, requestor.id, replacement), remove(token, requestor.id)];
        for (const pending of attempts) {
          const response = await pending;
          expect(response.status).toBe(403);
          expect(response.body).toEqual({ message: "Forbidden." });
        }
      }
      expect((await snapshot()).filter((user) => !callers.includes(user.id))).toEqual(before);
      expect(await db.user.count()).toBe(before.length + callers.length);
    });

    it("User endpoints require authentication", async () => {
      const { requestor } = await seed();
      const before = await snapshot();
      for (const pending of [list(), create(undefined, validNew), update(undefined, requestor.id, replacement), remove(undefined, requestor.id)]) {
        const response = await pending;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("User records omit authentication secrets", async () => {
      const { admin, requestor } = await seed();
      const requestorToken = await createSession(requestor);
      const listed = await list(admin.token);
      const created = await create(admin.token, validNew);
      const updated = await update(admin.token, requestor.id, replacement);
      for (const body of [...listed.body, created.body, updated.body]) {
        expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS);
      }
      const everything = JSON.stringify([listed.body, created.body, updated.body]);
      expect(everything).not.toContain(requestorToken);
      expect(everything).not.toContain(requestor.googleSub);
      expect(everything).not.toMatch(/googleSub|token|password/);
    });
  });

  describe("US-3.2 — Create an OC user account", () => {
    it("Admin provisions a user", async () => {
      const { admin, area1 } = await seed();
      const response = await create(admin.token, { ...validNew, role: "area_admin", areaId: area1.id });
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: expect.any(Number), email: "avery.reed@oc.edu", firstName: "Avery", lastName: "Reed", role: "area_admin", areaId: area1.id });
      expect(await stored(response.body.id)).toEqual({ ...response.body, googleSub: null });
    });

    it("Provisioned user signs in without losing assigned permissions", async () => {
      const { admin, area2 } = await seed();
      const pending = await create(admin.token, { ...validNew, role: "area_admin", areaId: area2.id });
      const before = await db.user.count();
      // Google's own names differ from the managed ones and must not overwrite them.
      stubGoogle({ sub: "google-sub-avery", email: "avery.reed@oc.edu", email_verified: true, hd: "oc.edu", given_name: "A.", family_name: "Reed-Google" });
      const login = await request(app).post("/vehicle-t6/login").send({ credential: "google-id-token" });
      expect(login.status).toBe(200);
      expect(login.body).toMatchObject({ userId: pending.body.id, firstName: "Avery", lastName: "Reed", role: "area_admin", areaId: area2.id });
      expect(await db.user.count()).toBe(before);
      expect(await stored(pending.body.id)).toEqual({ ...pending.body, googleSub: "google-sub-avery" });
    });

    it("Area admin cannot create a user", async () => {
      const { areaAdmin2 } = await seed();
      const before = await db.user.count();
      const plain = await create(areaAdmin2.token, validNew);
      expect(plain.status).toBe(403);
      expect(plain.body).toEqual({ message: "Forbidden." });
      const forged = await auth(request(app).post("/vehicle-t6/users?role=admin&userId=1"), areaAdmin2.token)
        .send({ ...validNew, callerRole: "admin", role: "requestor", userId: 1 });
      expect(forged.status).toBe(403);
      expect(forged.body).toEqual({ message: "Forbidden." });
      expect(await db.user.count()).toBe(before);
    });

    it("Duplicate OC email is rejected", async () => {
      const { admin } = await seed();
      const original = await createUser({ email: "person@oc.edu", firstName: "Pat", lastName: "Person", role: "requestor" });
      const response = await create(admin.token, { ...validNew, email: "  PERSON@OC.EDU " });
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Email is already in use." });
      expect(await stored(original.id)).toEqual({ ...publicRecord(original), googleSub: original.googleSub });
      expect(await db.user.count({ where: { email: "person@oc.edu" } })).toBe(1);
      // A sign-in that lands between the check and the insert: the unique index answers instead.
      const miss = jest.spyOn(db.user, "findOne").mockResolvedValueOnce(null);
      const raced = await create(admin.token, { ...validNew, email: "person@oc.edu" });
      miss.mockRestore();
      expect(raced.status).toBe(409);
      expect(raced.body).toEqual({ message: "Email is already in use." });
      expect(await db.user.count({ where: { email: "person@oc.edu" } })).toBe(1);
    });

    it("User values are normalized", async () => {
      const { admin } = await seed();
      const response = await create(admin.token, { email: "  New.Person@Eagles.OC.edu ", firstName: "  McKenzie ", lastName: " O'Neil  ", role: "maintenance", areaId: null });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ email: "new.person@eagles.oc.edu", firstName: "McKenzie", lastName: "O'Neil" });
      expect(await stored(response.body.id)).toEqual({ ...response.body, googleSub: null });
      // Values exactly at the column limits are still accepted.
      const longest = await create(admin.token, { email: `${"x".repeat(254 - "@oc.edu".length)}@oc.edu`, firstName: "n".repeat(100), lastName: "m".repeat(100), role: "requestor", areaId: null });
      expect(longest.status).toBe(201);
      expect(longest.body.email).toHaveLength(254);
    });

    it("Create cannot link an unverified Google identity", async () => {
      const { admin } = await seed();
      const response = await create(admin.token, { ...validNew, googleSub: "forged-sub", id: 99, token: "forged-token", password: "secret" });
      expect(response.status).toBe(201);
      expect(response.body.id).not.toBe(99);
      expect(Object.keys(response.body).sort()).toEqual(PUBLIC_KEYS);
      const record = await db.user.findByPk(response.body.id);
      expect(record.googleSub).toBeNull();
      expect(record.get({ plain: true })).not.toHaveProperty("password");
      expect(record.get({ plain: true })).not.toHaveProperty("token");
    });

    it("User firstName rejects invalid values", async () => {
      const { admin, requestor } = await seed();
      const before = await snapshot();
      for (const firstName of [undefined, null, 5, "", "   ", "a".repeat(101)]) {
        const body = firstName === undefined ? omit(validNew, "firstName") : { ...validNew, firstName };
        const posted = await create(admin.token, body);
        expect(posted.status).toBe(400);
        expect(posted.body).toEqual({ message: "Invalid user data." });
        const put = await update(admin.token, requestor.id, firstName === undefined ? omit(replacement, "firstName") : { ...replacement, firstName });
        expect(put.status).toBe(400);
        expect(put.body).toEqual({ message: "Invalid user data." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("User lastName rejects invalid values", async () => {
      const { admin, requestor } = await seed();
      const before = await snapshot();
      for (const lastName of [undefined, null, 5, "", "   ", "a".repeat(101)]) {
        const body = lastName === undefined ? omit(validNew, "lastName") : { ...validNew, lastName };
        const posted = await create(admin.token, body);
        expect(posted.status).toBe(400);
        expect(posted.body).toEqual({ message: "Invalid user data." });
        const put = await update(admin.token, requestor.id, lastName === undefined ? omit(replacement, "lastName") : { ...replacement, lastName });
        expect(put.status).toBe(400);
        expect(put.body).toEqual({ message: "Invalid user data." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Invalid provisioned email is rejected", async () => {
      const { admin } = await seed();
      const before = await db.user.count();
      const invalid = [undefined, null, "", "   ", 7, "not-an-email", "a@b", "two@@oc.edu", `${"x".repeat(250)}@oc.edu`, "someone@gmail.com", "someone@oc.edu.example.org", "someone@notoc.edu"];
      for (const email of invalid) {
        const body = email === undefined ? omit(validNew, "email") : { ...validNew, email };
        const response = await create(admin.token, body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid user data." });
      }
      expect(await db.user.count()).toBe(before);
    });

    it("Invalid or omitted role is rejected", async () => {
      const { admin, requestor } = await seed();
      const before = await snapshot();
      for (const role of [undefined, null, "", "superadmin", "Admin", 5]) {
        const posted = await create(admin.token, role === undefined ? omit(validNew, "role") : { ...validNew, role });
        expect(posted.status).toBe(400);
        expect(posted.body).toEqual({ message: "Invalid user data." });
        const put = await update(admin.token, requestor.id, role === undefined ? omit(replacement, "role") : { ...replacement, role });
        expect(put.status).toBe(400);
        expect(put.body).toEqual({ message: "Invalid user data." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Role and area must be consistent", async () => {
      const { admin, area1, requestor } = await seed();
      const before = await snapshot();
      const mismatches = [
        { role: "area_admin", areaId: null },
        { role: "area_admin" },
        { role: "requestor", areaId: area1.id },
        { role: "maintenance", areaId: area1.id },
        { role: "admin", areaId: area1.id },
        { role: "area_admin", areaId: String(area1.id) },
        { role: "area_admin", areaId: 0 },
        { role: "area_admin", areaId: -1 },
        { role: "area_admin", areaId: 1.5 },
        { role: "area_admin", areaId: 9007199254740993 },
        { role: "requestor" },
      ];
      for (const mismatch of mismatches) {
        const body = { ...omit(validNew, "areaId"), ...mismatch };
        const posted = await create(admin.token, body);
        expect(posted.status).toBe(400);
        expect(posted.body).toEqual({ message: "Invalid user data." });
        const put = await update(admin.token, requestor.id, { firstName: "Casey", lastName: "Req", ...mismatch });
        expect(put.status).toBe(400);
        expect(put.body).toEqual({ message: "Invalid user data." });
      }
      // The caller's own admin account with an area is a validation error, not a self-demotion conflict.
      const self = await update(admin.token, admin.user.id, { firstName: "Dana", lastName: "Admin", role: "admin", areaId: area1.id });
      expect(self.status).toBe(400);
      expect(self.body).toEqual({ message: "Invalid user data." });
      expect(await snapshot()).toEqual(before);
    });

    it("Missing assigned area is rejected", async () => {
      const { admin, requestor } = await seed();
      const before = await snapshot();
      const posted = await create(admin.token, { ...validNew, role: "area_admin", areaId: 999 });
      expect(posted.status).toBe(404);
      expect(posted.body).toEqual({ message: "Area with id=999 not found." });
      const put = await update(admin.token, requestor.id, { ...replacement, role: "area_admin", areaId: 999 });
      expect(put.status).toBe(404);
      expect(put.body).toEqual({ message: "Area with id=999 not found." });
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("US-3.3 — Update user details and access", () => {
    it("Admin updates user details", async () => {
      const { admin, area2, requestor } = await seed();
      const response = await update(admin.token, requestor.id, { firstName: "Casey", lastName: "Updated", role: "area_admin", areaId: area2.id });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: requestor.id, email: "req@oc.edu", firstName: "Casey", lastName: "Updated", role: "area_admin", areaId: area2.id });
      expect(await stored(requestor.id)).toEqual({ ...response.body, googleSub: requestor.googleSub });
    });

    it("Area admin updates an ordinary user without area filtering", async () => {
      const { areaAdmin2, requestor, maintenance } = await seed();
      const others = (await snapshot()).filter((user) => user.id !== requestor.id);
      const response = await update(areaAdmin2.token, requestor.id, { firstName: "Casey", lastName: "Renamed", role: "maintenance", areaId: null });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: requestor.id, email: "req@oc.edu", firstName: "Casey", lastName: "Renamed", role: "maintenance", areaId: null });
      expect((await snapshot()).filter((user) => user.id !== requestor.id)).toEqual(others);
      const back = await update(areaAdmin2.token, maintenance.id, { firstName: "Drew", lastName: "Fix", role: "requestor", areaId: null });
      expect(back.status).toBe(200);
      expect(back.body.role).toBe("requestor");
    });

    it("Area admin cannot modify a privileged account", async () => {
      const { admin, areaAdmin1, areaAdmin2 } = await seed();
      const other2 = await createUser({ role: "area_admin", areaId: areaAdmin2.user.areaId, email: "three@oc.edu", firstName: "Cy", lastName: "Three" });
      const before = await snapshot();
      for (const target of [areaAdmin2.user, areaAdmin1, other2, admin.user]) {
        const put = await update(areaAdmin2.token, target.id, { firstName: "X", lastName: "Y", role: "requestor", areaId: null });
        expect(put.status).toBe(403);
        expect(put.body).toEqual({ message: "Forbidden." });
        const del = await remove(areaAdmin2.token, target.id);
        expect(del.status).toBe(403);
        expect(del.body).toEqual({ message: "Forbidden." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Admin cannot remove its own administration access", async () => {
      const { admin, area1 } = await seed();
      const before = await snapshot();
      for (const body of [
        { firstName: "Dana", lastName: "Admin", role: "requestor", areaId: null },
        { firstName: "Dana", lastName: "Admin", role: "area_admin", areaId: area1.id },
        // The own-access check comes before field validation.
        { firstName: "", lastName: "Admin", role: "requestor", areaId: null },
      ]) {
        const put = await update(admin.token, admin.user.id, body);
        expect(put.status).toBe(409);
        expect(put.body).toEqual({ message: "You cannot remove your own admin access." });
      }
      const del = await remove(admin.token, admin.user.id);
      expect(del.status).toBe(409);
      expect(del.body).toEqual({ message: "You cannot remove your own admin access." });
      expect(await snapshot()).toEqual(before);
      expect((await me(admin.token)).status).toBe(200);
    });

    it("Admin can correct its own names", async () => {
      const { admin } = await seed();
      const response = await update(admin.token, admin.user.id, { firstName: "Danielle", lastName: "Administrator", role: "admin", areaId: null });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: admin.user.id, firstName: "Danielle", lastName: "Administrator", role: "admin", areaId: null });
      const still = await me(admin.token);
      expect(still.status).toBe(200);
      expect(still.body.firstName).toBe("Danielle");
    });

    it("Role or area changes revoke target sessions", async () => {
      const { admin, area2, areaAdmin1 } = await seed();
      const first = await createSession(areaAdmin1);
      const second = await createSession(areaAdmin1);
      expect((await me(first)).status).toBe(200);
      const response = await update(admin.token, areaAdmin1.id, { firstName: "Ari", lastName: "One", role: "area_admin", areaId: area2.id });
      expect(response.status).toBe(200);
      expect(response.body.areaId).toBe(area2.id);
      expect(await sessionsOf(areaAdmin1.id)).toBe(0);
      for (const token of [first, second]) {
        const refused = await me(token);
        expect(refused.status).toBe(401);
        expect(refused.body).toEqual({ message: "Unauthorized." });
      }
      stubGoogle({ sub: areaAdmin1.googleSub, email: areaAdmin1.email, email_verified: true, hd: "oc.edu", given_name: "Ari", family_name: "One" });
      const login = await request(app).post("/vehicle-t6/login").send({ credential: "google-id-token" });
      expect(login.status).toBe(200);
      expect(login.body).toMatchObject({ userId: areaAdmin1.id, role: "area_admin", areaId: area2.id });

      const demoted = await update(admin.token, areaAdmin1.id, { firstName: "Ari", lastName: "One", role: "requestor", areaId: null });
      expect(demoted.status).toBe(200);
      expect(await sessionsOf(areaAdmin1.id)).toBe(0);

      // A role change with the area unchanged (null to null) revokes sessions too.
      const third = await createSession(areaAdmin1);
      expect((await me(third)).status).toBe(200);
      const roleOnly = await update(admin.token, areaAdmin1.id, { firstName: "Ari", lastName: "One", role: "maintenance", areaId: null });
      expect(roleOnly.status).toBe(200);
      expect(await sessionsOf(areaAdmin1.id)).toBe(0);
      expect((await me(third)).status).toBe(401);
    });

    it("Name-only changes keep target sessions", async () => {
      const { admin, areaAdmin1 } = await seed();
      const token = await createSession(areaAdmin1);
      const response = await update(admin.token, areaAdmin1.id, { firstName: "Arielle", lastName: "One", role: "area_admin", areaId: areaAdmin1.areaId });
      expect(response.status).toBe(200);
      expect(await sessionsOf(areaAdmin1.id)).toBe(1);
      const still = await me(token);
      expect(still.status).toBe(200);
      expect(still.body.firstName).toBe("Arielle");
    });

    it("Email and Google identity cannot be changed by user editing", async () => {
      const { admin, requestor } = await seed();
      const response = await update(admin.token, requestor.id, { ...replacement, email: "other@oc.edu", googleSub: "forged-sub", id: 77 });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: requestor.id, email: "req@oc.edu", firstName: "Blake", lastName: "Ortiz", role: "maintenance", areaId: null });
      expect(await stored(requestor.id)).toEqual({ ...response.body, googleSub: requestor.googleSub });
    });

    it("Invalid user IDs are rejected", async () => {
      const { admin } = await seed();
      const before = await snapshot();
      for (const id of ["abc", "0", "-1", "1.5", "12abc", "9007199254740993", "1e3"]) {
        const put = await update(admin.token, id, replacement);
        expect(put.status).toBe(400);
        expect(put.body).toEqual({ message: "User id must be a positive integer." });
        const del = await remove(admin.token, id);
        expect(del.status).toBe(400);
        expect(del.body).toEqual({ message: "User id must be a positive integer." });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("Missing user IDs return not found", async () => {
      const { admin, areaAdmin2 } = await seed();
      // Both manager roles get the same answer: the target is checked before any area-admin limit.
      for (const token of [admin.token, areaAdmin2.token]) {
        const put = await update(token, 999, replacement);
        expect(put.status).toBe(404);
        expect(put.body).toEqual({ message: "User with id=999 not found." });
        const del = await remove(token, 999);
        expect(del.status).toBe(404);
        expect(del.body).toEqual({ message: "User with id=999 not found." });
      }
    });

    it("User storage failures do not partially change access", async () => {
      const { admin, area2, areaAdmin1, requestor } = await seed();
      await createSession(areaAdmin1);
      const before = await snapshot();
      const sessionsBefore = await db.session.count();
      const failures = [
        [() => jest.spyOn(db.user, "findAll").mockRejectedValueOnce(new Error("connection lost")), () => list(admin.token)],
        [() => jest.spyOn(db.user, "create").mockRejectedValueOnce(new Error("connection lost")), () => create(admin.token, validNew)],
        [() => jest.spyOn(db.user.prototype, "update").mockRejectedValueOnce(new Error("connection lost")), () => update(admin.token, requestor.id, replacement)],
        [() => jest.spyOn(db.session, "destroy").mockRejectedValueOnce(new Error("connection lost")), () => update(admin.token, areaAdmin1.id, { firstName: "Ari", lastName: "One", role: "area_admin", areaId: area2.id })],
        [() => jest.spyOn(db.session, "destroy").mockRejectedValueOnce(new Error("connection lost")), () => remove(admin.token, areaAdmin1.id)],
        // Sessions go first in a delete; a failing user row delete must bring them back.
        [() => jest.spyOn(db.user.prototype, "destroy").mockRejectedValueOnce(new Error("connection lost")), () => remove(admin.token, areaAdmin1.id)],
      ];
      for (const [arm, run] of failures) {
        const spy = arm();
        const response = await run();
        spy.mockRestore();
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ message: "User request failed." });
      }
      expect(await snapshot()).toEqual(before);
      expect(await db.session.count()).toBe(sessionsBefore);
      expect(await sessionsOf(areaAdmin1.id)).toBe(1);
    });

    it("Area admin cannot assign a privileged role", async () => {
      const { areaAdmin2, area1, requestor, maintenance } = await seed();
      const token = await createSession(requestor);
      const before = await snapshot();
      for (const [target, body] of [
        [requestor, { firstName: "Casey", lastName: "Req", role: "admin", areaId: null }],
        [maintenance, { firstName: "Drew", lastName: "Fix", role: "area_admin", areaId: area1.id }],
        [maintenance, { firstName: "Drew", lastName: "Fix", role: "area_admin", areaId: 999 }],
      ]) {
        const response = await update(areaAdmin2.token, target.id, body);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(await snapshot()).toEqual(before);
      expect((await me(token)).status).toBe(200);
    });

    it("Area admin cannot assign an area to an ordinary account", async () => {
      const { areaAdmin2, area1, area2, requestor, maintenance } = await seed();
      const before = await snapshot();
      for (const [target, areaId] of [[requestor, area1.id], [maintenance, area2.id]]) {
        const response = await update(areaAdmin2.token, target.id, { firstName: "Same", lastName: "Name", role: target.role, areaId });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Invalid user data." });
      }
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("US-3.4 — Delete a user account", () => {
    it("Admin deletes another user", async () => {
      const { admin, areaAdmin1 } = await seed();
      await createSession(areaAdmin1);
      await createSession(areaAdmin1);
      const response = await remove(admin.token, areaAdmin1.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "User deleted." });
      expect(await db.user.findByPk(areaAdmin1.id)).toBeNull();
      expect(await sessionsOf(areaAdmin1.id)).toBe(0);
      expect((await me(admin.token)).status).toBe(200);
    });

    it("Area admin deletes an ordinary user without area filtering", async () => {
      const { areaAdmin2, maintenance } = await seed();
      const others = (await snapshot()).filter((user) => user.id !== maintenance.id);
      const response = await remove(areaAdmin2.token, maintenance.id);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "User deleted." });
      expect(await db.user.findByPk(maintenance.id)).toBeNull();
      expect(await snapshot()).toEqual(others);
    });
  });
});
