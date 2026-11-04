// One trip reservation request owned by a requestor, naming an area, driver, destination or
// free-text city with mileage, schedule, passengers, purpose, optional notes, and shared status.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "reservationRequest",
    {
      requestorUserId: { type: DataTypes.INTEGER, allowNull: false },
      areaId: { type: DataTypes.INTEGER, allowNull: false },
      driverId: { type: DataTypes.INTEGER, allowNull: false },
      destinationId: { type: DataTypes.INTEGER, allowNull: true },
      destinationCity: { type: DataTypes.STRING(100), allowNull: true },
      estimatedMiles: { type: DataTypes.DECIMAL(6, 1), allowNull: true },
      departureDate: { type: DataTypes.DATEONLY, allowNull: false },
      departureTime: { type: DataTypes.STRING(5), allowNull: true },
      returnDate: { type: DataTypes.DATEONLY, allowNull: false },
      returnTime: { type: DataTypes.STRING(5), allowNull: true },
      passengers: { type: DataTypes.INTEGER, allowNull: false },
      purpose: { type: DataTypes.STRING(500), allowNull: false },
      noteType: { type: DataTypes.STRING(32), allowNull: true },
      noteText: { type: DataTypes.STRING(1000), allowNull: true },
      status: { type: DataTypes.STRING(32), allowNull: false },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_as_ci",
    }
  );
