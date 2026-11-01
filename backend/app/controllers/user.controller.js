import db from "../models/index.js";
import logger from "../config/logger.js";
import authConfig from "../config/auth.config.js";
import { safeMessage } from "../authorization/authorization.js";

const ROLES = ["admin", "area_admin", "requestor", "maintenance"];
const PRIVILEGED = ["admin", "area_admin"];
const LIMITS = { email: 254, name: 100 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

// The public user record: never the Google subject, sessions, or anything else.
const publicRecord = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  areaId: user.areaId ?? null,
});

const trimmedName = (value) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= LIMITS.name ? text : null;
};

// Provisioned emails are trimmed, lowercase, well formed, and inside the approved OC domains.
const normalizedEmail = (value) => {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > LIMITS.email || !EMAIL_PATTERN.test(email)) return null;
  return authConfig.approvedDomains.includes(email.split("@")[1]) ? email : null;
};

const isPositiveSafeInteger = (value) => Number.isSafeInteger(value) && value > 0;

// Role and area go together: an area admin names exactly one area, every other role sends null.
function accessFields(body) {
  const role = ROLES.includes(body?.role) ? body.role : null;
  if (!role) return null;
  if (role === "area_admin") {
    return isPositiveSafeInteger(body.areaId) ? { role, areaId: body.areaId } : null;
  }
  return body.areaId === null ? { role, areaId: null } : null;
}

const parseUserId = (raw) => {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return isPositiveSafeInteger(id) ? id : null;
};

// Every outcome is decided as { status, body } so the checks and the write can share one transaction.
const reply = (status, body) => ({ status, body });
const invalidData = () => reply(400, { message: "Invalid user data." });
const invalidId = () => reply(400, { message: "User id must be a positive integer." });
const forbidden = () => reply(403, { message: "Forbidden." });
const userNotFound = (id) => reply(404, { message: `User with id=${id} not found.` });
const areaNotFound = (id) => reply(404, { message: `Area with id=${id} not found.` });
const emailInUse = () => reply(409, { message: "Email is already in use." });
const ownAccess = () => reply(409, { message: "You cannot remove your own admin access." });

const send = (res, outcome) => res.status(outcome.status).send(outcome.body);
const failed = (res, operation, error) => {
  logger.error(`User ${operation} failed: ${safeMessage(error)}`);
  return res.status(500).send({ message: "User request failed." });
};

// A shared lock keeps the area from being deleted while the user write that references it commits.
const areaExists = async (areaId, transaction) =>
  (await db.area.findByPk(areaId, { transaction, lock: transaction.LOCK.SHARE })) !== null;

// The target row is locked for the whole decision, so a concurrent role change cannot be
// overwritten by an area admin or slip past session revocation.
const lockedUser = (id, transaction) => db.user.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });

const controller = {};

// Both manager roles see every account, by last name, first name, then id.
controller.list = async (_req, res) => {
  try {
    const users = await db.user.findAll({ order: [["lastName", "ASC"], ["firstName", "ASC"], ["id", "ASC"]] });
    return res.status(200).send(users.map(publicRecord));
  } catch (error) {
    return failed(res, "list", error);
  }
};

// Admin provisions a pending account; Google links it on that person's first sign-in.
controller.create = async (req, res) => {
  const email = normalizedEmail(req.body?.email);
  const firstName = trimmedName(req.body?.firstName);
  const lastName = trimmedName(req.body?.lastName);
  const access = accessFields(req.body);
  if (!email || !firstName || !lastName || !access) return send(res, invalidData());
  try {
    const outcome = await db.sequelize.transaction(async (transaction) => {
      if (await db.user.findOne({ where: { email }, transaction })) return emailInUse();
      if (access.role === "area_admin" && !(await areaExists(access.areaId, transaction))) return areaNotFound(access.areaId);
      const user = await db.user.create(
        { email, firstName, lastName, role: access.role, areaId: access.areaId, googleSub: null },
        { transaction },
      );
      return reply(201, publicRecord(user));
    });
    return send(res, outcome);
  } catch (error) {
    if (error instanceof db.Sequelize.UniqueConstraintError) return send(res, emailInUse());
    return failed(res, "create", error);
  }
};

// Check order follows the spec: route id, target exists, area-admin limits (403), own admin
// access (409), field validation (400), area exists (404), then one atomic write.
controller.update = async (req, res) => {
  const id = parseUserId(req.params.id);
  if (id === null) return send(res, invalidId());
  try {
    const outcome = await db.sequelize.transaction(async (transaction) => {
      const target = await lockedUser(id, transaction);
      if (!target) return userNotFound(id);

      const caller = req.user;
      if (caller.role === "area_admin") {
        if (PRIVILEGED.includes(target.role)) return forbidden();
        if (PRIVILEGED.includes(req.body?.role)) return forbidden();
      }
      if (caller.role === "admin" && caller.id === id && req.body?.role !== "admin") return ownAccess();

      const firstName = trimmedName(req.body?.firstName);
      const lastName = trimmedName(req.body?.lastName);
      const access = accessFields(req.body);
      if (!firstName || !lastName || !access) return invalidData();
      if (access.role === "area_admin" && !(await areaExists(access.areaId, transaction))) return areaNotFound(access.areaId);

      // Changing role or area ends every session of the target in the same transaction.
      const accessChanged = target.role !== access.role || (target.areaId ?? null) !== access.areaId;
      await target.update({ firstName, lastName, role: access.role, areaId: access.areaId }, { transaction });
      if (accessChanged) {
        await db.session.destroy({ where: { userId: id }, transaction });
      }
      return reply(200, publicRecord(target));
    });
    return send(res, outcome);
  } catch (error) {
    return failed(res, "update", error);
  }
};

// Removes the account and its sessions together; never the caller's own admin account.
controller.remove = async (req, res) => {
  const id = parseUserId(req.params.id);
  if (id === null) return send(res, invalidId());
  try {
    const outcome = await db.sequelize.transaction(async (transaction) => {
      const target = await lockedUser(id, transaction);
      if (!target) return userNotFound(id);
      if (req.user.role === "area_admin" && PRIVILEGED.includes(target.role)) return forbidden();
      if (req.user.role === "admin" && req.user.id === id) return ownAccess();
      await db.session.destroy({ where: { userId: id }, transaction });
      await target.destroy({ transaction });
      return reply(200, { message: "User deleted." });
    });
    return send(res, outcome);
  } catch (error) {
    return failed(res, "delete", error);
  }
};

export default controller;
