import nodemailer from "nodemailer";

export const CONFIGURATION_INVALID = "EMAIL_CONFIGURATION_INVALID";
export const RUN_FAILED = "EMAIL_RUN_FAILED";

/** Missing or invalid SMTP settings: the run is skipped before any job is created or claimed. */
export class EmailConfigurationError extends Error {
  constructor() {
    super(CONFIGURATION_INVALID);
    this.code = CONFIGURATION_INVALID;
  }
}

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const value = (raw) => (typeof raw === "string" ? raw.trim() : "");

/** Reads SMTP settings from the environment on every run, so corrected settings apply on the next tick. */
export function readSmtpConfig(env = process.env) {
  const host = value(env.SMTP_HOST);
  const port = value(env.SMTP_PORT);
  const from = value(env.SMTP_FROM);
  const secure = value(env.SMTP_SECURE);
  const user = value(env.SMTP_USER);
  const password = typeof env.SMTP_PASSWORD === "string" ? env.SMTP_PASSWORD : "";

  const portNumber = /^\d{1,5}$/.test(port) ? Number(port) : 0;
  const valid =
    host.length > 0 &&
    !/\s/.test(host) &&
    portNumber >= 1 &&
    portNumber <= 65535 &&
    ADDRESS.test(from) &&
    (secure === "true" || secure === "false") &&
    (user.length > 0) === (password.length > 0);
  if (!valid) throw new EmailConfigurationError();

  return { host, port: portNumber, from, secure: secure === "true", user: user || null, password: password || null };
}

// Every SMTP submission ends (accepted or failed) well before its five-minute claim expires, so a slow
// provider can never let another dispatcher claim and resubmit a job that is still in flight.
export const SEND_TIMEOUT_MS = 2 * 60 * 1000;

/** Nodemailer SMTP options with per-stage timeouts shorter than the claim lifetime. */
export const smtpTransportOptions = (config) => ({
  host: config.host,
  port: config.port,
  secure: config.secure,
  connectionTimeout: 30 * 1000,
  greetingTimeout: 30 * 1000,
  socketTimeout: 60 * 1000,
  ...(config.user ? { auth: { user: config.user, pass: config.password } } : {}),
});

/**
 * Process-wide email dependencies. Tests replace `now` and `createTransport` with a fixed clock and a
 * fake transport; production uses the real clock and Nodemailer SMTP.
 */
export const emailRuntime = {
  now: () => new Date(),
  createTransport: (config) => nodemailer.createTransport(smtpTransportOptions(config)),
};
