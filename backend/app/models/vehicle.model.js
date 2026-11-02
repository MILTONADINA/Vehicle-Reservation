// One OC fleet vehicle assigned to a single area. VIN is unique ignoring case; designatedParking is the pickup spot for later day-before emails.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "vehicle",
    {
      make: { type: DataTypes.STRING(40), allowNull: false },
      model: { type: DataTypes.STRING(40), allowNull: false },
      year: { type: DataTypes.INTEGER, allowNull: false },
      vin: { type: DataTypes.STRING(17), allowNull: false },
      purchasedDate: { type: DataTypes.DATEONLY, allowNull: false },
      color: { type: DataTypes.STRING(40), allowNull: false },
      passengers: { type: DataTypes.INTEGER, allowNull: false },
      plateNumber: { type: DataTypes.STRING(20), allowNull: false },
      plateExpireMonth: { type: DataTypes.INTEGER, allowNull: false },
      designatedParking: { type: DataTypes.STRING(200), allowNull: false },
      areaId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_as_ci",
      indexes: [{ unique: true, fields: ["vin"] }],
    }
  );
