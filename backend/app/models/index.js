import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";
import userModel from "./user.model.js";
import sessionModel from "./session.model.js";
import areaModel from "./area.model.js";

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = userModel(sequelize, Sequelize);
db.session = sessionModel(sequelize, Sequelize);
db.area = areaModel(sequelize, Sequelize);

// Sessions belong to one user and are deleted with that user.
const sessionUserKey = { name: "userId", allowNull: false };
db.user.hasMany(db.session, { foreignKey: sessionUserKey, as: "sessions", onDelete: "CASCADE" });
db.session.belongsTo(db.user, { foreignKey: sessionUserKey, as: "user", onDelete: "CASCADE" });

// An area admin is assigned one area. An area with assigned users cannot be deleted.
const userAreaKey = { name: "areaId", allowNull: true };
db.area.hasMany(db.user, { foreignKey: userAreaKey, as: "users", onDelete: "RESTRICT" });
db.user.belongsTo(db.area, { foreignKey: userAreaKey, as: "area", onDelete: "RESTRICT" });

export default db;
