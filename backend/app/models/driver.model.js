// One OC driver record, separate from User accounts. Drivers are organization-wide (no area).
export default (sequelize, DataTypes) =>
  sequelize.define(
    "driver",
    {
      firstName: { type: DataTypes.STRING(100), allowNull: false },
      lastName: { type: DataTypes.STRING(100), allowNull: false },
      licenseState: { type: DataTypes.STRING(2), allowNull: false },
      licenseExpireDate: { type: DataTypes.DATEONLY, allowNull: false },
      approvedDate: { type: DataTypes.DATEONLY, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_as_ci",
    }
  );
