import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";
import userModel from "./user.model.js";
import sessionModel from "./session.model.js";
import areaModel from "./area.model.js";
import vehicleModel from "./vehicle.model.js";
import driverModel from "./driver.model.js";
import destinationModel from "./destination.model.js";
import reservationRequestModel from "./reservationRequest.model.js";

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = userModel(sequelize, Sequelize);
db.session = sessionModel(sequelize, Sequelize);
db.area = areaModel(sequelize, Sequelize);
db.vehicle = vehicleModel(sequelize, Sequelize);
db.driver = driverModel(sequelize, Sequelize);
db.destination = destinationModel(sequelize, Sequelize);
db.reservationRequest = reservationRequestModel(sequelize, Sequelize);

// Sessions belong to one user and are deleted with that user.
const sessionUserKey = { name: "userId", allowNull: false };
db.user.hasMany(db.session, { foreignKey: sessionUserKey, as: "sessions", onDelete: "CASCADE" });
db.session.belongsTo(db.user, { foreignKey: sessionUserKey, as: "user", onDelete: "CASCADE" });

// An area admin is assigned one area. An area with assigned users cannot be deleted.
const userAreaKey = { name: "areaId", allowNull: true };
db.area.hasMany(db.user, { foreignKey: userAreaKey, as: "users", onDelete: "RESTRICT" });
db.user.belongsTo(db.area, { foreignKey: userAreaKey, as: "area", onDelete: "RESTRICT" });

// Vehicles belong to one area. An area with vehicles cannot be deleted.
const vehicleAreaKey = { name: "areaId", allowNull: false };
db.area.hasMany(db.vehicle, { foreignKey: vehicleAreaKey, as: "vehicles", onDelete: "RESTRICT" });
db.vehicle.belongsTo(db.area, { foreignKey: vehicleAreaKey, as: "area", onDelete: "RESTRICT" });

// A requestor owns reservation requests. A user with requests cannot be deleted.
const requestorUserKey = { name: "requestorUserId", allowNull: false };
db.user.hasMany(db.reservationRequest, { foreignKey: requestorUserKey, as: "reservationRequests", onDelete: "RESTRICT" });
db.reservationRequest.belongsTo(db.user, { foreignKey: requestorUserKey, as: "requestor", onDelete: "RESTRICT" });

// Reservation requests belong to one area. An area with requests cannot be deleted.
const requestAreaKey = { name: "areaId", allowNull: false };
db.area.hasMany(db.reservationRequest, { foreignKey: requestAreaKey, as: "reservationRequests", onDelete: "RESTRICT" });
db.reservationRequest.belongsTo(db.area, { foreignKey: requestAreaKey, as: "area", onDelete: "RESTRICT" });

// Reservation requests name one driver. A driver with requests cannot be deleted.
const requestDriverKey = { name: "driverId", allowNull: false };
db.driver.hasMany(db.reservationRequest, { foreignKey: requestDriverKey, as: "reservationRequests", onDelete: "RESTRICT" });
db.reservationRequest.belongsTo(db.driver, { foreignKey: requestDriverKey, as: "driver", onDelete: "RESTRICT" });

// Reservation requests may name one catalog destination. A destination with requests cannot be deleted.
const requestDestinationKey = { name: "destinationId", allowNull: true };
db.destination.hasMany(db.reservationRequest, { foreignKey: requestDestinationKey, as: "reservationRequests", onDelete: "RESTRICT" });
db.reservationRequest.belongsTo(db.destination, { foreignKey: requestDestinationKey, as: "destination", onDelete: "RESTRICT" });

// Reservation requests may reference one vehicle. A vehicle with requests cannot be deleted.
const requestVehicleKey = { name: "vehicleId", allowNull: true };
db.vehicle.hasMany(db.reservationRequest, { foreignKey: requestVehicleKey, as: "reservationRequests", onDelete: "RESTRICT" });
db.reservationRequest.belongsTo(db.vehicle, { foreignKey: requestVehicleKey, as: "vehicle", onDelete: "RESTRICT" });

export default db;
