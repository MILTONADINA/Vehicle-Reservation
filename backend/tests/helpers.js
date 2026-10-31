import db from "../app/models/index.js";

/** Recreate every registered table so each test starts from an empty schema. */
export const syncTestDatabase = async () => {
  await db.sequelize.sync({ force: true });
};
