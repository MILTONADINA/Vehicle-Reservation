import jwt from "jsonwebtoken";
import db from "../models/index.js";
import authConfig from "../config/auth.config.js";
import logger from "../config/logger.js";

const JWT_PATTERN = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const EMAIL_PATTERN = /[^\s@"'`]+@[^\s@"'`]+\.[^\s@"'`]+/g;

/** Error text safe for application logs: embedded application tokens and email addresses are masked. */
export const safeMessage = (error) =>
  String(error?.message ?? error).replace(JWT_PATTERN, "[token]").replace(EMAIL_PATTERN, "[email]");

const unauthorized = (res) => res.status(401).send({ message: "Unauthorized." });

// Runs before protected requests. The Bearer token must verify, match a stored session that has
// not expired, and still belong to an existing user. The role always comes from the database row.
export async function authenticate(req, res, next) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!match) {
    return unauthorized(res);
  }
  const token = match[1];

  let payload;
  try {
    payload = jwt.verify(token, authConfig.secret);
  } catch {
    return unauthorized(res);
  }

  let session;
  try {
    session = await db.session.findOne({ where: { token }, include: [{ model: db.user, as: "user" }] });
  } catch (error) {
    logger.error(`Session lookup failed: ${safeMessage(error)}`);
    return res.status(500).send({ message: "Session could not be checked." });
  }

  if (!session || !session.user || session.userId !== payload.userId || session.expirationDate.getTime() <= Date.now()) {
    return unauthorized(res);
  }

  req.user = { id: session.user.id, role: session.user.role, areaId: session.user.areaId ?? null };
  req.account = session.user;
  req.session = session;
  return next();
}

// Lets the request continue only when the stored role is one the route allows.
export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).send({ message: "Forbidden." });
  }
  return next();
};
