// An OC unit that handles a group of vehicles, with its logo and day-before-trip reminder text.
// The table collation is case-insensitive but accent-sensitive, so the unique areaName index
// treats "athletics" and "Athletics" as the same name and nothing else as a duplicate.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "area",
    {
      areaName: { type: DataTypes.STRING(100), allowNull: false },
      areaLogo: { type: DataTypes.STRING(2048), allowNull: false },
      noticeEmail: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_0900_as_ci",
      indexes: [{ unique: true, fields: ["areaName"] }],
    }
  );
