import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";
import userModel from "./user.model.js";
import sessionModel from "./session.model.js";
import areaModel from "./area.model.js";
import vehicleModel from "./vehicle.model.js";
import driverModel from "./driver.model.js";
import destinationModel from "./destination.model.js";
import reservationRequestModel from "./reservationRequest.model.js";
import reservationEmailModel from "./reservationEmail.model.js";
import issueReportModel from "./issueReport.model.js";
import mileageLogModel from "./mileageLog.model.js";
import serviceLogModel from "./serviceLog.model.js";

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
db.reservationEmail = reservationEmailModel(sequelize, Sequelize);
db.issueReport = issueReportModel(sequelize, Sequelize);
db.mileageLog = mileageLogModel(sequelize, Sequelize);
db.serviceLog = serviceLogModel(sequelize, Sequelize);

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

// Email notifications belong to one reservation request. A request with email jobs cannot be deleted.
const emailRequestKey = { name: "reservationRequestId", allowNull: false };
db.reservationRequest.hasMany(db.reservationEmail, { foreignKey: emailRequestKey, as: "emails", onDelete: "RESTRICT" });
db.reservationEmail.belongsTo(db.reservationRequest, { foreignKey: emailRequestKey, as: "reservationRequest", onDelete: "RESTRICT" });

// Issue reports belong to one reservation request. A request with issues cannot be deleted.
const issueRequestKey = { name: "requestId", allowNull: false };
db.reservationRequest.hasMany(db.issueReport, { foreignKey: issueRequestKey, as: "issues", onDelete: "RESTRICT" });
db.issueReport.belongsTo(db.reservationRequest, { foreignKey: issueRequestKey, as: "reservationRequest", onDelete: "RESTRICT" });

// An issue may snapshot the request's assigned vehicle. A vehicle with issues cannot be deleted.
const issueVehicleKey = { name: "vehicleId", allowNull: true };
db.vehicle.hasMany(db.issueReport, { foreignKey: issueVehicleKey, as: "issueReports", onDelete: "RESTRICT" });
db.issueReport.belongsTo(db.vehicle, { foreignKey: issueVehicleKey, as: "vehicle", onDelete: "RESTRICT" });

// The signed-in reporter owns the issue row. A user who reported an issue cannot be deleted.
const issueReporterKey = { name: "reportedByUserId", allowNull: false };
db.user.hasMany(db.issueReport, { foreignKey: issueReporterKey, as: "issueReports", onDelete: "RESTRICT" });
db.issueReport.belongsTo(db.user, { foreignKey: issueReporterKey, as: "reporter", onDelete: "RESTRICT" });

// Mileage logs belong to one vehicle. A vehicle with mileage logs cannot be deleted.
const mileageVehicleKey = { name: "vehicleId", allowNull: false };
db.vehicle.hasMany(db.mileageLog, { foreignKey: mileageVehicleKey, as: "mileageLogs", onDelete: "RESTRICT" });
db.mileageLog.belongsTo(db.vehicle, { foreignKey: mileageVehicleKey, as: "vehicle", onDelete: "RESTRICT" });

// The signed-in logger owns the mileage row. A user who logged mileage cannot be deleted.
const mileageLoggerKey = { name: "loggedByUserId", allowNull: false };
db.user.hasMany(db.mileageLog, { foreignKey: mileageLoggerKey, as: "mileageLogs", onDelete: "RESTRICT" });
db.mileageLog.belongsTo(db.user, { foreignKey: mileageLoggerKey, as: "logger", onDelete: "RESTRICT" });

// Service logs belong to one vehicle. A vehicle with service logs cannot be deleted.
const serviceVehicleKey = { name: "vehicleId", allowNull: false };
db.vehicle.hasMany(db.serviceLog, { foreignKey: serviceVehicleKey, as: "serviceLogs", onDelete: "RESTRICT" });
db.serviceLog.belongsTo(db.vehicle, { foreignKey: serviceVehicleKey, as: "vehicle", onDelete: "RESTRICT" });

// The signed-in logger owns the service row. A user who logged a service cannot be deleted.
const serviceLoggerKey = { name: "loggedByUserId", allowNull: false };
db.user.hasMany(db.serviceLog, { foreignKey: serviceLoggerKey, as: "serviceLogs", onDelete: "RESTRICT" });
db.serviceLog.belongsTo(db.user, { foreignKey: serviceLoggerKey, as: "logger", onDelete: "RESTRICT" });

export default db;
