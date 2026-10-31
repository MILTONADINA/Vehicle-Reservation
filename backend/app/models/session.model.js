// One application session per signed JWT. The unique index covers the first 255 characters:
// MySQL caps index keys at 3072 bytes, and a JWT's random jti sits well inside that prefix.
export default (sequelize, DataTypes) =>
  sequelize.define(
    "session",
    {
      token: { type: DataTypes.STRING(1024), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false },
      expirationDate: { type: DataTypes.DATE, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
    },
    { indexes: [{ unique: true, fields: [{ name: "token", length: 255 }] }] }
  );
