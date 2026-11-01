import db from "../models/index.js";
import logger from "../config/logger.js";
import { safeMessage } from "../authorization/authorization.js";

const LIMITS = { areaName: 100, areaLogo: 2048, noticeEmail: 5000 };

// The area contract: generated id plus the three fields, nothing else.
const areaPayload = (area) => ({
  id: area.id,
  areaName: area.areaName,
  areaLogo: area.areaLogo,
  noticeEmail: area.noticeEmail,
});

const trimmed = (value, limit) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= limit ? text : null;
};

const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
};

// Only the three area fields are read; outer whitespace is trimmed and nothing else is changed.
function validAreaFields(body) {
  const areaName = trimmed(body?.areaName, LIMITS.areaName);
  const areaLogo = trimmed(body?.areaLogo, LIMITS.areaLogo);
  const noticeEmail = trimmed(body?.noticeEmail, LIMITS.noticeEmail);
  if (!areaName || !areaLogo || !noticeEmail || !isHttpsUrl(areaLogo)) {
    return null;
  }
  return { areaName, areaLogo, noticeEmail };
}

// Route ids must be positive safe integers written as plain digits.
const parseAreaId = (raw) => {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// Name uniqueness ignores case; the record being edited may keep its own name.
async function nameTaken(areaName, exceptId = null) {
  const where = [db.sequelize.where(db.sequelize.fn("LOWER", db.sequelize.col("areaName")), areaName.toLowerCase())];
  if (exceptId !== null) where.push({ id: { [db.Sequelize.Op.ne]: exceptId } });
  return (await db.area.count({ where: { [db.Sequelize.Op.and]: where } })) > 0;
}

const invalidData = (res) => res.status(400).send({ message: "Invalid area data." });
const invalidId = (res) => res.status(400).send({ message: "Area id must be a positive integer." });
const notFound = (res, id) => res.status(404).send({ message: `Area with id=${id} not found.` });
const nameInUse = (res) => res.status(409).send({ message: "Area name is already in use." });
const failed = (res, operation, error) => {
  logger.error(`Area ${operation} failed: ${safeMessage(error)}`);
  return res.status(500).send({ message: "Area request failed." });
};

const controller = {};

// Every signed-in role sees every area, by name then id.
controller.list = async (_req, res) => {
  try {
    const areas = await db.area.findAll({ order: [["areaName", "ASC"], ["id", "ASC"]] });
    return res.status(200).send(areas.map(areaPayload));
  } catch (error) {
    return failed(res, "list", error);
  }
};

controller.create = async (req, res) => {
  const fields = validAreaFields(req.body);
  if (!fields) return invalidData(res);
  try {
    if (await nameTaken(fields.areaName)) return nameInUse(res);
    const area = await db.area.create(fields);
    return res.status(201).send(areaPayload(area));
  } catch (error) {
    if (error instanceof db.Sequelize.UniqueConstraintError) return nameInUse(res);
    return failed(res, "create", error);
  }
};

// PUT replaces the three fields. An area admin's scope is the database assignment, never the request.
controller.update = async (req, res) => {
  const id = parseAreaId(req.params.id);
  if (id === null) return invalidId(res);
  if (req.user.role === "area_admin" && req.user.areaId !== id) return notFound(res, id);
  const fields = validAreaFields(req.body);
  if (!fields) return invalidData(res);
  try {
    const area = await db.area.findByPk(id);
    if (!area) return notFound(res, id);
    if (await nameTaken(fields.areaName, id)) return nameInUse(res);
    await area.update(fields);
    return res.status(200).send(areaPayload(area));
  } catch (error) {
    if (error instanceof db.Sequelize.UniqueConstraintError) return nameInUse(res);
    return failed(res, "update", error);
  }
};

// Deletion is refused while any record still references the area.
controller.remove = async (req, res) => {
  const id = parseAreaId(req.params.id);
  if (id === null) return invalidId(res);
  try {
    const area = await db.area.findByPk(id);
    if (!area) return notFound(res, id);
    await area.destroy();
    return res.status(200).send({ message: "Area deleted." });
  } catch (error) {
    if (error instanceof db.Sequelize.ForeignKeyConstraintError) {
      return res.status(409).send({ message: "Area is in use." });
    }
    return failed(res, "delete", error);
  }
};

export default controller;
