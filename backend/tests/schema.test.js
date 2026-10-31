import db from "../app/models/index.js";

// Development starts the server with sync({ alter: true }); the schema must stay stable across restarts.
const uniqueIndexCount = async (table, column) => {
  const [rows] = await db.sequelize.query(`SHOW INDEX FROM \`${table}\` WHERE Column_name = '${column}' AND Non_unique = 0`);
  return rows.length;
};

afterAll(async () => { await db.sequelize.close(); });

describe("Schema sync", () => {
  it("keeps one unique index per column across repeated alter syncs", async () => {
    await db.sequelize.sync({ force: true });
    await db.sequelize.sync({ alter: true });
    await db.sequelize.sync({ alter: true });
    expect(await uniqueIndexCount("users", "email")).toBe(1);
    expect(await uniqueIndexCount("users", "googleSub")).toBe(1);
    expect(await uniqueIndexCount("sessions", "token")).toBe(1);
  });
});
