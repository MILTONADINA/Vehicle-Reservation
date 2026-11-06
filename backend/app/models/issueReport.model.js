// One vehicle issue report on a reservation request: type, timing, optional note, and optional vehicle snapshot.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "issueReport",
    {
      requestId: { type: DataTypes.INTEGER, allowNull: false },
      vehicleId: { type: DataTypes.INTEGER, allowNull: true },
      issueType: {
        type: DataTypes.ENUM("low_gas", "dirty", "maintenance_need"),
        allowNull: false,
      },
      timing: {
        type: DataTypes.ENUM("before", "during", "after"),
        allowNull: false,
      },
      note: { type: DataTypes.STRING(1000), allowNull: true },
      reportedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_as_ci",
    }
  );
