/**
 * Feature 1 — User Authentication & Authorization
 * Spec: features/feature-1-user-authentication-authorization.md
 */
import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import winston from "winston";
import { Writable } from "stream";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import app from "../server.js";
import db from "../app/models/index.js";
import logger from "../app/config/logger.js";
import authConfig from "../app/config/auth.config.js";
import { authenticate, requireRole } from "../app/authorization/authorization.js";
import { OAuth2Client } from "google-auth-library";
import { googleVerifier, GoogleCredentialError, GoogleUnavailableError } from "../app/authorization/googleVerifier.js";
import { seedAdmin } from "../app/scripts/seed-admin.mjs";
import { syncTestDatabase } from "./helpers.js";

// The real verifier, captured before any test replaces it, for the cases that exercise google-auth-library.
const realVerifyIdToken = googleVerifier.verifyIdToken;
const useRealVerifier = (googleClientBehaviour) => {
  googleVerifier.verifyIdToken = realVerifyIdToken;
  return jest.spyOn(OAuth2Client.prototype, "verifyIdToken").mockImplementation(googleClientBehaviour);
};

const backendDir = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const roles = ["admin", "area_admin", "requestor", "maintenance"];
const avery = {
  sub: "google-sub-avery", email: "avery.reed@oc.edu", email_verified: true, hd: "oc.edu",
  given_name: "Avery", family_name: "Reed",
};
const account = { userId: expect.any(Number), email: "avery.reed@oc.edu", firstName: "Avery", lastName: "Reed", role: "requestor", areaId: null };

// Test-only routes exercise the role guard without adding product endpoints.
let protectedOperationRan = false;
for (const role of roles) {
  app.get(`/vehicle-t6/test-only/${role}`, authenticate, requireRole(role), (req, res) => {
    protectedOperationRan = true;
    res.send({ user: req.user });
  });
}

const stubGoogle = (payload) => { googleVerifier.verifyIdToken = jest.fn(async () => payload); };
const stubGoogleFailure = (error) => { googleVerifier.verifyIdToken = jest.fn(async () => { throw error; }); };
const login = (body = { credential: "google-id-token" }) => request(app).post("/vehicle-t6/login").send(body);
const me = (token) => request(app).get("/vehicle-t6/auth/me").set("Authorization", `Bearer ${token}`);
const logout = (token) => request(app).post("/vehicle-t6/logout").set("Authorization", `Bearer ${token}`);

// Signs in one Google identity and optionally changes the stored role afterwards.
async function signIn(overrides = {}, role) {
  stubGoogle({ ...avery, ...overrides });
  const response = await login();
  expect(response.status).toBe(200);
  if (role) await db.user.update({ role }, { where: { id: response.body.userId } });
  return response.body;
}

const expiredToken = (userId) => jwt.sign({ userId, exp: Math.floor(Date.now() / 1000) - 3600 }, authConfig.secret);

beforeEach(async () => {
  await syncTestDatabase();
  protectedOperationRan = false;
  stubGoogle(avery);
});
afterAll(async () => { await db.sequelize.close(); });

describe("Feature 1 — User Authentication & Authorization", () => {
  describe("US-1.1 — Sign in with an OC Google account", () => {
    it("New OC user signs in", async () => {
      // The real verifier asks google-auth-library to check the token against GOOGLE_CLIENT_ID.
      const googleClient = useRealVerifier(async () => ({ getPayload: () => avery }));
      const response = await login();
      expect(googleClient).toHaveBeenCalledWith({ idToken: "google-id-token", audience: "test-google-client-id" });
      googleClient.mockRestore();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...account, token: expect.any(String) });
      expect(response.body).not.toHaveProperty("googleSub");
      expect(response.body).not.toHaveProperty("credential");
      const users = await db.user.findAll();
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({ googleSub: "google-sub-avery", email: "avery.reed@oc.edu", role: "requestor" });
      const sessions = await db.session.findAll();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({ userId: users[0].id, token: response.body.token, email: "avery.reed@oc.edu" });
      expect(sessions[0].expirationDate.getTime()).toBeGreaterThan(Date.now());
    });

    it("Existing OC user signs in", async () => {
      const first = await signIn({}, "maintenance");
      const second = await login();
      expect(second.status).toBe(200);
      expect(second.body.userId).toBe(first.userId);
      expect(second.body.role).toBe("maintenance");
      expect(await db.user.count()).toBe(1);

      // Google may report the address in any case; it still resolves to the same stored lowercase user.
      stubGoogle({ ...avery, email: "Avery.Reed@OC.edu", hd: "OC.edu" });
      const mixedCase = await login();
      expect(mixedCase.status).toBe(200);
      expect(mixedCase.body).toMatchObject({ userId: first.userId, email: "avery.reed@oc.edu" });
      expect(await db.user.count()).toBe(1);

      // Two first sign-ins racing: the loser of the insert race still gets the one stored user.
      await db.sequelize.sync({ force: true });
      const realCreate = db.user.create.bind(db.user);
      const racing = jest.spyOn(db.user, "create").mockImplementationOnce(async (values, options) => {
        await realCreate(values);
        throw new db.Sequelize.UniqueConstraintError({ message: "users.googleSub must be unique" });
      });
      const raced = await login();
      racing.mockRestore();
      expect(raced.status).toBe(200);
      expect(await db.user.count()).toBe(1);
      expect(raced.body.userId).toBe((await db.user.findOne()).id);
    });

    it("Provisioned OC user links the first Google sign-in", async () => {
      const provisioned = await db.user.create({ googleSub: null, email: "avery.reed@oc.edu", firstName: "Provisioned", lastName: "Account", role: "admin" });
      expect((await db.user.findByPk(provisioned.id)).googleSub).toBeNull();
      const response = await login();
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ userId: provisioned.id, firstName: "Provisioned", lastName: "Account", role: "admin" });
      const stored = await db.user.findByPk(provisioned.id);
      expect(stored).toMatchObject({ googleSub: "google-sub-avery", firstName: "Provisioned", lastName: "Account", role: "admin" });
      expect(await db.user.count()).toBe(1);
    });

    it("Google subject cannot claim another local email", async () => {
      const linked = await db.user.create({ googleSub: "google-sub-avery", email: "avery.reed@oc.edu", firstName: "Avery", lastName: "Reed", role: "requestor" });
      const other = await db.user.create({ email: "blake.ortiz@oc.edu", firstName: "Blake", lastName: "Ortiz", role: "maintenance" });

      stubGoogle({ ...avery, email: "blake.ortiz@oc.edu" });
      const response = await login();
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "Google account could not be linked." });

      stubGoogle({ ...avery, sub: "google-sub-someone-else" });
      const takenEmail = await login();
      expect(takenEmail.status).toBe(409);
      expect(takenEmail.body).toEqual({ message: "Google account could not be linked." });

      expect(await db.user.findByPk(linked.id)).toMatchObject({ googleSub: "google-sub-avery", email: "avery.reed@oc.edu" });
      expect(await db.user.findByPk(other.id)).toMatchObject({ googleSub: null, email: "blake.ortiz@oc.edu", role: "maintenance" });
      expect(await db.user.count()).toBe(2);
      expect(await db.session.count()).toBe(0);
    });

    it("Missing Google credential is rejected", async () => {
      for (const body of [{}, { credential: "" }, { credential: "   " }, { credential: 42 }, { credential: null }]) {
        const response = await login(body);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: "Google credential is required." });
      }
      expect(googleVerifier.verifyIdToken).not.toHaveBeenCalled();
      expect(await db.user.count()).toBe(0);
      expect(await db.session.count()).toBe(0);
    });

    it("Invalid Google credentials are rejected", async () => {
      for (const reason of ["Invalid token signature", "Wrong issuer", "Wrong recipient, audience mismatch", "Token used too late"]) {
        stubGoogleFailure(new GoogleCredentialError(reason));
        const response = await login({ credential: `bad-${reason}` });
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Google sign-in failed." });
      }
      // The real verifier maps a google-auth-library token error to the same 401.
      const googleClient = useRealVerifier(async () => { throw new Error("Invalid token signature: eyJ.bad.sig"); });
      const rejected = await login({ credential: "forged-token" });
      googleClient.mockRestore();
      expect(rejected.status).toBe(401);
      expect(rejected.body).toEqual({ message: "Google sign-in failed." });
      expect(await db.user.count()).toBe(0);
      expect(await db.session.count()).toBe(0);
    });

    it("Non-OC Google account is rejected", async () => {
      const outsiders = [
        { hd: "gmail.com", email: "avery.reed@gmail.com" },
        { hd: undefined, email: "avery.reed@gmail.com" },
        { hd: "oc.edu.example.org", email: "avery.reed@oc.edu.example.org" },
        { hd: "eagles.oc.edu.example.org", email: "avery.reed@eagles.oc.edu.example.org" },
        { hd: "notoc.edu", email: "avery.reed@notoc.edu" },
        { hd: "oc.edu", email: "avery.reed@gmail.com" },
        { hd: undefined, email: "avery.reed@oc.edu" },
      ];
      for (const identity of outsiders) {
        stubGoogle({ ...avery, ...identity });
        const response = await login();
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Use your OC Google account." });
      }
      expect(await db.user.count()).toBe(0);
      expect(await db.session.count()).toBe(0);
    });

    it("Unverified Google email is rejected", async () => {
      stubGoogle({ ...avery, email_verified: false });
      const response = await login();
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Use your OC Google account." });
      expect(await db.user.count()).toBe(0);
      expect(await db.session.count()).toBe(0);
    });

    it("Client cannot choose a role or identity", async () => {
      const response = await login({ credential: "google-id-token", role: "admin", userId: 99, email: "forged@oc.edu", googleSub: "forged-sub" });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email: "avery.reed@oc.edu", role: "requestor" });
      expect(response.body.userId).not.toBe(99);
      const user = await db.user.findByPk(response.body.userId);
      expect(user).toMatchObject({ email: "avery.reed@oc.edu", googleSub: "google-sub-avery", role: "requestor" });
      expect(await db.user.count()).toBe(1);
    });

    it("Google verification unavailable is reported", async () => {
      stubGoogleFailure(new GoogleUnavailableError("getaddrinfo ENOTFOUND www.googleapis.com"));
      const response = await login();
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ message: "Google sign-in is unavailable. Try again." });

      // The real verifier treats any failure to fetch Google's certificates as unavailable: DNS, a 429 from
      // the certificate endpoint, or a TLS error (google-auth-library reports these as transport errors).
      const transportFailures = [
        Object.assign(new Error("getaddrinfo ENOTFOUND www.googleapis.com"), { code: "ENOTFOUND", config: {} }),
        Object.assign(new Error("Failed to retrieve verification certificates: Request failed with status code 429"), { code: 429, config: {}, response: { status: 429 } }),
        Object.assign(new Error("Failed to retrieve verification certificates: self signed certificate"), { code: "DEPTH_ZERO_SELF_SIGNED_CERT", config: {} }),
      ];
      let offline;
      for (const failure of transportFailures) {
        offline?.mockRestore();
        offline = useRealVerifier(async () => { throw failure; });
        const unreachable = await login();
        expect(unreachable.status).toBe(503);
        expect(unreachable.body).toEqual({ message: "Google sign-in is unavailable. Try again." });
      }

      // Without a configured client ID the server never accepts a credential it cannot check the audience of.
      const clientId = process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;
      try {
        offline.mockClear();
        const unconfigured = await login();
        expect(unconfigured.status).toBe(503);
        expect(offline).not.toHaveBeenCalled();
      } finally {
        process.env.GOOGLE_CLIENT_ID = clientId;
        offline.mockRestore();
      }
      expect(await db.user.count()).toBe(0);
      expect(await db.session.count()).toBe(0);
    });

    it("Login storage failure is reported", async () => {
      const failing = jest.spyOn(db.session, "create").mockRejectedValueOnce(new Error("connection lost"));
      const response = await login();
      failing.mockRestore();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Sign-in could not be completed." });
      expect(await db.user.count()).toBe(0);
      expect(await db.session.count()).toBe(0);

      // No signing secret means no session can be issued: the same 500, nothing committed, no built-in fallback secret.
      const configuredSecret = authConfig.secret;
      authConfig.secret = undefined;
      try {
        const unsigned = await login();
        expect(unsigned.status).toBe(500);
        expect(unsigned.body).toEqual({ message: "Sign-in could not be completed." });
      } finally {
        authConfig.secret = configuredSecret;
      }
      expect(await db.user.count()).toBe(0);
      expect(await db.session.count()).toBe(0);
      const savedEnvSecret = process.env.AUTH_SECRET;
      delete process.env.AUTH_SECRET;
      try {
        const { default: freshConfig } = await import("../app/config/auth.config.js?without-env-secret");
        expect(freshConfig.secret).toBeUndefined();
      } finally {
        process.env.AUTH_SECRET = savedEnvSecret;
      }
    });

    it("Authentication logs exclude credentials and secrets", async () => {
      const lines = [];
      const capture = new winston.transports.Stream({
        stream: new Writable({ write(chunk, _encoding, done) { lines.push(chunk.toString()); done(); } }),
        level: "debug",
      });
      const previousLevel = logger.level;
      logger.level = "debug";
      logger.add(capture);
      try {
        const credential = "google-credential-SECRET-VALUE";
        const success = await login({ credential });
        expect(success.status).toBe(200);
        // google-auth-library embeds the raw token in some rejection messages; the log keeps only the reason.
        const rejectingClient = useRealVerifier(async () => { throw new Error("Invalid token signature: rejected-credential-SECRET-VALUE"); });
        await login({ credential: "rejected-credential-SECRET-VALUE" });
        rejectingClient.mockRestore();
        const failing = jest.spyOn(db.session, "destroy").mockRejectedValueOnce(new Error("connection lost"));
        await logout(success.body.token);
        failing.mockRestore();
        await logout(success.body.token);
        await me(success.body.token);

        // A database error whose text carries a token and an email is logged masked.
        const duplicate = () => new db.Sequelize.UniqueConstraintError({ message: `Duplicate entry '${success.body.token}' for ${avery.email}` });
        const racing = jest.spyOn(db.session, "create").mockRejectedValueOnce(duplicate()).mockRejectedValueOnce(duplicate());
        await db.sequelize.sync({ force: true });
        stubGoogle(avery);
        expect((await login({ credential })).status).toBe(500);
        racing.mockRestore();

        const output = lines.join("\n");
        expect(output).toContain("signed in");
        expect(output).toContain("Google credential rejected: Invalid token signature");
        expect(output).toContain("Login failed: Duplicate entry '[token]' for [email]");
        expect(output).not.toContain(credential);
        expect(output).not.toContain("SECRET-VALUE");
        expect(output).not.toContain(success.body.token);
        expect(output).not.toContain(authConfig.secret);
        expect(output).not.toContain(avery.email);
      } finally {
        logger.remove(capture);
        logger.level = previousLevel;
      }
    });

    it("Missing Google name claims do not invent personal data", async () => {
      stubGoogle({ sub: "google-sub-nameless", email: "nameless@eagles.oc.edu", email_verified: true, hd: "eagles.oc.edu" });
      const response = await login();
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email: "nameless@eagles.oc.edu", firstName: "", lastName: "", role: "requestor" });
      const user = await db.user.findByPk(response.body.userId);
      expect(user.firstName).toBe("");
      expect(user.lastName).toBe("");
    });
  });

  describe("US-1.2 — Keep a valid application session", () => {
    it("Valid session returns the current account", async () => {
      const { token } = await signIn();
      const response = await me(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(account);
      expect(response.body).not.toHaveProperty("token");
      expect(response.body).not.toHaveProperty("googleSub");
    });

    it("Valid session is reused on sign-in", async () => {
      const first = await login();
      const second = await login();
      expect(second.status).toBe(200);
      expect(second.body.token).toBe(first.body.token);
      const sessions = await db.session.findAll();
      expect(sessions).toHaveLength(1);
      expect(jwt.decode(first.body.token).exp * 1000).toBe(sessions[0].expirationDate.getTime());
    });

    it("Expired session is replaced on sign-in", async () => {
      const user = await db.user.create({ googleSub: "google-sub-avery", email: "avery.reed@oc.edu", firstName: "Avery", lastName: "Reed", role: "requestor" });
      const staleToken = expiredToken(user.id);
      await db.session.create({ token: staleToken, email: user.email, expirationDate: new Date(Date.now() - 3600000), userId: user.id });

      const before = Date.now();
      const response = await login();
      expect(response.status).toBe(200);
      expect(response.body.token).not.toBe(staleToken);
      const fresh = await db.session.findOne({ where: { token: response.body.token } });
      const lifetime = fresh.expirationDate.getTime() - before;
      expect(lifetime).toBeGreaterThan(24 * 3600000 - 5000);
      expect(lifetime).toBeLessThanOrEqual(24 * 3600000 + 5000);
      expect(jwt.decode(response.body.token).exp * 1000).toBe(fresh.expirationDate.getTime());
      expect((await me(staleToken)).status).toBe(401);
      expect((await me(response.body.token)).status).toBe(200);
      expect(await db.session.count({ where: { token: staleToken } })).toBe(0);
      expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    });

    it("Missing or invalid application session is rejected", async () => {
      const { token, userId } = await signIn();
      const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
      const expired = expiredToken(userId);
      await db.session.create({ token: expired, email: avery.email, expirationDate: new Date(Date.now() - 1000), userId });
      const unknownSession = jwt.sign({ userId }, authConfig.secret, { expiresIn: "24h" });
      // A token that still verifies but whose stored session row has lapsed is rejected by the row, not the JWT.
      const lapsedRow = jwt.sign({ userId, jti: "lapsed" }, authConfig.secret, { expiresIn: "24h" });
      await db.session.create({ token: lapsedRow, email: avery.email, expirationDate: new Date(Date.now() - 1000), userId });

      const cases = [
        request(app).get("/vehicle-t6/auth/me"),
        request(app).get("/vehicle-t6/auth/me").set("Authorization", "Token abc"),
        me("not-a-jwt"),
        me(tampered),
        me(expired),
        me(unknownSession),
        me(lapsedRow),
      ];
      for (const pending of cases) {
        const response = await pending;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({ message: "Unauthorized." });
      }
      expect((await me(token)).status).toBe(200);
    });

    it("Deleted user session cannot authenticate", async () => {
      const { token, userId } = await signIn();
      // FOREIGN_KEY_CHECKS is per connection, so the toggle and the delete share one transaction.
      await db.sequelize.transaction(async (transaction) => {
        await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0", { transaction });
        await db.user.destroy({ where: { id: userId }, transaction });
        await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1", { transaction });
      });
      expect(await db.session.count({ where: { token } })).toBe(1);
      const response = await me(token);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: "Unauthorized." });
    });

    it("Role is read from the database on every request", async () => {
      const { token, userId } = await signIn();
      expect((await me(token)).body.role).toBe("requestor");
      await db.user.update({ role: "admin" }, { where: { id: userId } });
      const response = await me(token);
      expect(response.status).toBe(200);
      expect(response.body.role).toBe("admin");
    });

    it("Unexpired invalid stored session is replaced", async () => {
      const user = await db.user.create({ googleSub: "google-sub-avery", email: "avery.reed@oc.edu", firstName: "Avery", lastName: "Reed", role: "requestor" });
      const forged = jwt.sign({ userId: user.id }, "another-secret", { expiresIn: "24h" });
      await db.session.create({ token: forged, email: user.email, expirationDate: new Date(Date.now() + 3600000), userId: user.id });

      const response = await login();
      expect(response.status).toBe(200);
      expect(response.body.token).not.toBe(forged);
      expect(jwt.verify(response.body.token, authConfig.secret).userId).toBe(user.id);
      expect((await me(forged)).status).toBe(401);
      expect((await me(response.body.token)).status).toBe(200);
    });

    it("Session lookup storage failure returns a safe error", async () => {
      const { token } = await signIn();
      const failing = jest.spyOn(db.session, "findOne").mockRejectedValueOnce(new Error("connection lost"));
      const response = await me(token);
      failing.mockRestore();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Session could not be checked." });
      expect(await db.session.count()).toBe(1);
      expect((await me(token)).status).toBe(200);
    });
  });

  describe("US-1.3 — Enforce application roles", () => {
    it("Stored role controls access to a role-protected endpoint", async () => {
      for (const role of roles) {
        const { token, userId } = await signIn({ sub: `sub-${role}`, email: `${role}@oc.edu` }, role);
        const response = await request(app).get(`/vehicle-t6/test-only/${role}`).set("Authorization", `Bearer ${token}`);
        expect(response.status).toBe(200);
        expect(response.body.user).toEqual({ id: userId, role, areaId: null });
      }
    });

    it("Disallowed role receives Forbidden", async () => {
      const { token } = await signIn({}, "requestor");
      for (const role of ["admin", "area_admin", "maintenance"]) {
        const response = await request(app).get(`/vehicle-t6/test-only/${role}`).set("Authorization", `Bearer ${token}`);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      // No role is implied by another: an admin is refused by routes that name other roles.
      const admin = await signIn({ sub: "sub-admin", email: "admin@oc.edu" }, "admin");
      for (const role of ["requestor", "maintenance", "area_admin"]) {
        const response = await request(app).get(`/vehicle-t6/test-only/${role}`).set("Authorization", `Bearer ${admin.token}`);
        expect(response.status).toBe(403);
        expect(response.body).toEqual({ message: "Forbidden." });
      }
      expect(protectedOperationRan).toBe(false);
    });

    it("Forged local role grants no server permissions", async () => {
      const { token } = await signIn({}, "requestor");
      const response = await request(app)
        .get("/vehicle-t6/test-only/admin?role=admin")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Role", "admin")
        .send({ role: "admin" });
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden." });
      expect(protectedOperationRan).toBe(false);
    });
  });

  describe("US-1.4 — Sign out", () => {
    it("Sign-out invalidates the current session", async () => {
      const { token, userId } = await signIn();
      for (const pending of [request(app).post("/vehicle-t6/logout"), logout(expiredToken(userId)), logout("not-a-jwt")]) {
        const refused = await pending;
        expect(refused.status).toBe(401);
        expect(refused.body).toEqual({ message: "Unauthorized." });
      }
      expect(await db.session.count()).toBe(1);

      const response = await logout(token);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Signed out." });
      expect(await db.session.count()).toBe(0);
      const afterwards = await me(token);
      expect(afterwards.status).toBe(401);
      expect(afterwards.body).toEqual({ message: "Unauthorized." });
      expect((await logout(token)).status).toBe(401);
    });

    it("Sign-out does not end other sessions", async () => {
      const first = await signIn();
      const second = await signIn({ sub: "google-sub-blake", email: "blake.ortiz@oc.edu", given_name: "Blake", family_name: "Ortiz" });
      expect((await logout(first.token)).status).toBe(200);
      expect(await db.session.count()).toBe(1);
      expect((await me(second.token)).status).toBe(200);
      expect((await me(first.token)).status).toBe(401);
    });

    it("Logout storage failure preserves the session", async () => {
      const { token } = await signIn();
      const failing = jest.spyOn(db.session, "destroy").mockRejectedValueOnce(new Error("connection lost"));
      const response = await logout(token);
      failing.mockRestore();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Sign-out could not be completed. Try again." });
      expect(await db.session.count()).toBe(1);
      expect((await me(token)).status).toBe(200);
    });
  });

  describe("US-1.5 — Bootstrap the initial administrator", () => {
    const seedInput = { ADMIN_EMAIL: "Dean.Harper@oc.edu", ADMIN_FIRST_NAME: "Dean", ADMIN_LAST_NAME: "Harper" };

    it("Initial administrator is provisioned explicitly", async () => {
      const result = await seedAdmin(seedInput);
      expect(result.created).toBe(true);
      const users = await db.user.findAll();
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({ email: "dean.harper@oc.edu", firstName: "Dean", lastName: "Harper", role: "admin", googleSub: null });
      expect(users[0].toJSON()).not.toHaveProperty("password");
    });

    it("Admin seed is idempotent without promoting users", async () => {
      await seedAdmin(seedInput);
      const [admin] = await db.user.findAll();
      const again = await seedAdmin({ ...seedInput, ADMIN_FIRST_NAME: "Changed", ADMIN_LAST_NAME: "Names" });
      expect(again.created).toBe(false);
      expect(await db.user.count()).toBe(1);
      expect(await db.user.findByPk(admin.id)).toMatchObject({ firstName: "Dean", lastName: "Harper", role: "admin", googleSub: null });

      const requestor = await db.user.create({ email: "sam.lee@oc.edu", firstName: "Sam", lastName: "Lee", role: "requestor" });
      await expect(seedAdmin({ ...seedInput, ADMIN_EMAIL: "sam.lee@oc.edu" })).rejects.toThrow();
      expect((await db.user.findByPk(requestor.id)).role).toBe("requestor");
      expect(await db.user.count()).toBe(2);
    });

    it("Invalid admin seed input creates nothing", async () => {
      const invalid = [
        { ...seedInput, ADMIN_EMAIL: "" },
        { ...seedInput, ADMIN_EMAIL: undefined },
        { ...seedInput, ADMIN_FIRST_NAME: "   " },
        { ...seedInput, ADMIN_LAST_NAME: "" },
        { ...seedInput, ADMIN_EMAIL: "dean.harper@gmail.com" },
        { ...seedInput, ADMIN_EMAIL: "dean.harper@oc.edu.example.org" },
        { ...seedInput, ADMIN_EMAIL: "not-an-email" },
      ];
      for (const input of invalid) {
        await expect(seedAdmin(input)).rejects.toThrow();
      }
      const cli = spawnSync(process.execPath, ["app/scripts/seed-admin.mjs"], {
        cwd: backendDir,
        env: { ...process.env, ADMIN_EMAIL: "dean.harper@gmail.com", ADMIN_FIRST_NAME: "Dean", ADMIN_LAST_NAME: "Harper" },
        encoding: "utf8",
      });
      expect(cli.status).toBe(1);
      expect(await db.user.count()).toBe(0);
    });
  });
});
