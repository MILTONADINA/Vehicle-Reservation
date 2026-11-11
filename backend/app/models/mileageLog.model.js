// One odometer reading for a vehicle on a calendar date.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "mileageLog",
    {
      vehicleId: { type: DataTypes.INTEGER, allowNull: false },
      logDate: { type: DataTypes.DATEONLY, allowNull: false },
      mileage: { type: DataTypes.INTEGER, allowNull: false },
      loggedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_as_ci",
    }
  );
