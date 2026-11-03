// One organization-wide trip destination with address and round-trip mileage estimate.
// Collation is case-insensitive so the unique destinationName index treats "Airport" and "airport" as the same.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "destination",
    {
      destinationName: { type: DataTypes.STRING(100), allowNull: false },
      addressLine: { type: DataTypes.STRING(200), allowNull: false },
      city: { type: DataTypes.STRING(100), allowNull: false },
      state: { type: DataTypes.STRING(2), allowNull: false },
      zipCode: { type: DataTypes.STRING(5), allowNull: false },
      roundTripMiles: { type: DataTypes.DECIMAL(6, 1), allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_as_ci",
      indexes: [{ unique: true, fields: ["destinationName"] }],
    }
  );
