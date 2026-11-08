// One service event (repair, oil change, or tire replacement) for a vehicle on a calendar date.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "serviceLog",
    {
      vehicleId: { type: DataTypes.INTEGER, allowNull: false },
      serviceDate: { type: DataTypes.DATEONLY, allowNull: false },
      serviceType: {
        type: DataTypes.ENUM("repair", "oil_change", "tire_replacement"),
        allowNull: false,
      },
      note: { type: DataTypes.STRING(1000), allowNull: true },
      loggedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_as_ci",
    }
  );
