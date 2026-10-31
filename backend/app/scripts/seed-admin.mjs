// Provisions the initial administrator from ADMIN_EMAIL, ADMIN_FIRST_NAME and ADMIN_LAST_NAME.
// Run with `npm run seed:admin`. The admin signs in with Google like everyone else; no password exists.
import { pathToFileURL } from "url";
import db from "../models/index.js";
import authConfig from "../config/auth.config.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

export function adminValues(environment = process.env) {
  const email = String(environment.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const firstName = String(environment.ADMIN_FIRST_NAME ?? "").trim();
  const lastName = String(environment.ADMIN_LAST_NAME ?? "").trim();
  if (!firstName) throw new Error("ADMIN_FIRST_NAME is required.");
  if (!lastName) throw new Error("ADMIN_LAST_NAME is required.");
  if (!EMAIL_PATTERN.test(email) || !authConfig.approvedDomains.includes(email.split("@")[1])) {
    throw new Error(`ADMIN_EMAIL must be a ${authConfig.approvedDomains.join(" or ")} address.`);
  }
  return { email, firstName, lastName };
}

// Creates the admin once. An existing admin is left as is; an existing non-admin is never promoted.
export async function seedAdmin(environment = process.env) {
  const values = adminValues(environment);
  const existing = await db.user.findOne({ where: { email: values.email } });
  if (existing) {
    if (existing.role !== "admin") {
      throw new Error(`${values.email} already exists with role ${existing.role} and was not changed.`);
    }
    return { created: false, user: existing };
  }
  const user = await db.user.create({ ...values, role: "admin", googleSub: null });
  return { created: true, user };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    adminValues();
    await db.sequelize.sync();
    const { created, user } = await seedAdmin();
    process.stdout.write(`Admin seed completed: ${user.email} ${created ? "created" : "already present"}.\n`);
  } catch (error) {
    process.stderr.write(`Admin seed failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
}
