// A local account linked to one OC Google identity. Provisioned accounts start with no googleSub.
// Unique keys are declared as model indexes: attribute-level `unique` makes sync({ alter: true })
// add a duplicate index on every restart.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "user",
    {
      googleSub: { type: DataTypes.STRING(255), allowNull: true },
      email: { type: DataTypes.STRING(254), allowNull: false },
      firstName: { type: DataTypes.STRING(100), allowNull: false },
      lastName: { type: DataTypes.STRING(100), allowNull: false },
      role: {
        type: DataTypes.ENUM("admin", "area_admin", "requestor", "maintenance"),
        allowNull: false,
        defaultValue: "requestor",
      },
      // Only area admins are assigned an area; every other role keeps null.
      areaId: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      indexes: [
        { unique: true, fields: ["email"] },
        { unique: true, fields: ["googleSub"] },
      ],
    }
  );
