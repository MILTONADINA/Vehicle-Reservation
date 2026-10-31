import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";
import userModel from "./user.model.js";
import sessionModel from "./session.model.js";

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = userModel(sequelize, Sequelize);
db.session = sessionModel(sequelize, Sequelize);

// Sessions belong to one user and are deleted with that user.
const sessionUserKey = { name: "userId", allowNull: false };
db.user.hasMany(db.session, { foreignKey: sessionUserKey, as: "sessions", onDelete: "CASCADE" });
db.session.belongsTo(db.user, { foreignKey: sessionUserKey, as: "user", onDelete: "CASCADE" });

export default db;
