import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import db from "../app/models/index.js";
import authConfig from "../app/config/auth.config.js";

/** Recreate every registered table so each test starts from an empty schema. */
export const syncTestDatabase = async () => {
  await db.sequelize.sync({ force: true });
};

let userCounter = 0;

/** A stored user with a unique Google subject and email; defaults to a requestor. */
export const createUser = (overrides = {}) => {
  userCounter += 1;
  return db.user.create({
    googleSub: `test-sub-${userCounter}-${randomUUID()}`,
    email: `user${userCounter}@oc.edu`,
    firstName: "Test",
    lastName: `User${userCounter}`,
    role: "requestor",
    ...overrides,
  });
};

/** A valid application session for the user, written through the model exactly as login does. */
export const createSession = async (user) => {
  const token = jwt.sign({ userId: user.id, jti: randomUUID() }, authConfig.secret, { expiresIn: "24h" });
  await db.session.create({ token, email: user.email, expirationDate: new Date(jwt.decode(token).exp * 1000), userId: user.id });
  return token;
};

/** A signed-in user of the given role: `{ user, token }`. */
export const signInAs = async (role, overrides = {}) => {
  const user = await createUser({ role, ...overrides });
  return { user, token: await createSession(user) };
};
