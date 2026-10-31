import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { Op } from "sequelize";
import db from "../models/index.js";
import authConfig from "../config/auth.config.js";
import logger from "../config/logger.js";
import { safeMessage } from "../authorization/authorization.js";
import { googleVerifier, GoogleUnavailableError } from "../authorization/googleVerifier.js";

const SESSION_SECONDS = 24 * 60 * 60;

// The account fields every signed-in response shares. areaId stays null until Feature 2 adds the column.
const accountPayload = (user) => ({
  userId: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  areaId: user.areaId ?? null,
});

// Accepts only a verified identity whose hosted domain and email domain are both OC domains.
function approvedIdentity(payload) {
  const email = String(payload?.email ?? "").trim().toLowerCase();
  const emailDomain = email.split("@")[1];
  const hostedDomain = String(payload?.hd ?? "").trim().toLowerCase();
  const approved =
    payload?.email_verified === true &&
    typeof payload.sub === "string" && payload.sub.length > 0 &&
    authConfig.approvedDomains.includes(emailDomain) &&
    authConfig.approvedDomains.includes(hostedDomain);
  if (!approved) {
    return null;
  }
  return {
    sub: payload.sub,
    email,
    firstName: typeof payload.given_name === "string" ? payload.given_name : "",
    lastName: typeof payload.family_name === "string" ? payload.family_name : "",
  };
}

// Finds the user for a verified identity: by Google subject first, then by provisioned email.
// Returns { conflict: true } when the identity would claim or overwrite someone else's account.
async function findOrLinkUser(identity, transaction) {
  const bySubject = await db.user.findOne({ where: { googleSub: identity.sub }, transaction });
  const byEmail = await db.user.findOne({ where: { email: identity.email }, transaction });

  if (bySubject) {
    if (byEmail && byEmail.id !== bySubject.id) {
      return { conflict: true };
    }
    return { user: bySubject };
  }
  if (byEmail) {
    if (byEmail.googleSub) {
      return { conflict: true };
    }
    await byEmail.update({ googleSub: identity.sub }, { transaction });
    return { user: byEmail };
  }
  const user = await db.user.create(
    { googleSub: identity.sub, email: identity.email, firstName: identity.firstName, lastName: identity.lastName, role: "requestor" },
    { transaction }
  );
  return { user };
}

// Reuses an unexpired session whose token still verifies; otherwise issues a 24-hour session.
// Expired rows for the user are removed in the same transaction so the table does not grow forever.
async function reuseOrCreateSession(user, transaction) {
  const now = new Date();
  await db.session.destroy({ where: { userId: user.id, expirationDate: { [Op.lte]: now } }, transaction });
  const sessions = await db.session.findAll({
    where: { userId: user.id, expirationDate: { [Op.gt]: now } },
    order: [["createdAt", "DESC"]],
    transaction,
  });
  for (const session of sessions) {
    try {
      if (jwt.verify(session.token, authConfig.secret).userId === user.id) {
        return session;
      }
    } catch {
      // A stored token that no longer verifies is never reused.
    }
  }
  const token = jwt.sign({ userId: user.id, jti: randomUUID() }, authConfig.secret, { expiresIn: SESSION_SECONDS });
  const expirationDate = new Date(jwt.decode(token).exp * 1000);
  return db.session.create({ token, email: user.email, expirationDate, userId: user.id }, { transaction });
}

// One atomic attempt to resolve the user and session for a verified identity.
const signInTransaction = (identity) =>
  db.sequelize.transaction(async (transaction) => {
    const { user, conflict } = await findOrLinkUser(identity, transaction);
    if (conflict) {
      return { conflict: true };
    }
    const session = await reuseOrCreateSession(user, transaction);
    return { user, session };
  });

const controller = {};

// Sign in: verifies the Google credential, finds or creates the local user, and returns a session.
controller.login = async (req, res) => {
  const credential = req.body?.credential;
  if (typeof credential !== "string" || !credential.trim()) {
    return res.status(400).send({ message: "Google credential is required." });
  }

  let googlePayload;
  try {
    googlePayload = await googleVerifier.verifyIdToken(credential);
  } catch (error) {
    if (error instanceof GoogleUnavailableError) {
      logger.warn(`Google verification unavailable: ${safeMessage(error)}`);
      return res.status(503).send({ message: "Google sign-in is unavailable. Try again." });
    }
    logger.warn(`Google credential rejected: ${safeMessage(error)}`);
    return res.status(401).send({ message: "Google sign-in failed." });
  }

  const identity = approvedIdentity(googlePayload);
  if (!identity) {
    logger.warn("Google identity outside the approved OC domains was rejected.");
    return res.status(403).send({ message: "Use your OC Google account." });
  }

  try {
    let result;
    try {
      result = await signInTransaction(identity);
    } catch (error) {
      // Two first sign-ins for the same identity can race on the insert; the loser retries and finds the row.
      if (!(error instanceof db.Sequelize.UniqueConstraintError)) {
        throw error;
      }
      result = await signInTransaction(identity);
    }
    if (result.conflict) {
      return res.status(409).send({ message: "Google account could not be linked." });
    }
    logger.info(`User ${result.user.id} signed in.`);
    return res.status(200).send({ ...accountPayload(result.user), token: result.session.token });
  } catch (error) {
    logger.error(`Login failed: ${safeMessage(error)}`);
    return res.status(500).send({ message: "Sign-in could not be completed." });
  }
};

// Current account for the presented session; never includes the token.
controller.me = (req, res) => res.status(200).send(accountPayload(req.account));

// Sign out: deletes only the session presented in the Bearer header.
controller.logout = async (req, res) => {
  try {
    await db.session.destroy({ where: { id: req.session.id } });
    logger.info(`User ${req.user.id} signed out.`);
    return res.status(200).send({ message: "Signed out." });
  } catch (error) {
    logger.error(`Logout failed: ${safeMessage(error)}`);
    return res.status(500).send({ message: "Sign-out could not be completed. Try again." });
  }
};

export default controller;
