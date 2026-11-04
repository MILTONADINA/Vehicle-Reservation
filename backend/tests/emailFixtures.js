/**
 * Shared fixtures for the Feature 9 email tests: lower-feature records, a fixed clock, a fake SMTP
 * transport, and a stub node-cron scheduler. No test sends live email or starts a live schedule.
 */
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../server.js";
import db from "../app/models/index.js";
import { emailRuntime } from "../app/reservationEmails/emailConfig.js";
import { registerEmailSchedule } from "../app/reservationEmails/emailSchedule.js";
import { createUser } from "./helpers.js";

export const SMTP_ENV = {
  SMTP_HOST: "smtp.test.invalid",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_FROM: "vehicles@oc.edu",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
};

const original = { now: emailRuntime.now, createTransport: emailRuntime.createTransport };
/** The production transport factory, before any test replaces it. */
export const realCreateTransport = original.createTransport;
const savedEnv = {};

/** A deterministic transport: records every submission and fails the ones `fail(message)` selects. */
export function fakeTransport(fail = () => false) {
  const transport = {
    attempts: [],
    sent: [],
    fail,
    sendMail: async (message) => {
      transport.attempts.push(message);
      if (transport.fail(message)) throw new Error(`550 rejected ${message.to}`);
      transport.sent.push(message);
      return { accepted: [message.to] };
    },
  };
  return transport;
}

/** Installs a fixed clock, a fake transport, and valid SMTP settings; returns the controls. */
export function installEmailRuntime(isoNow = "2026-11-04T15:00:00.000Z") {
  for (const key of Object.keys(SMTP_ENV)) {
    savedEnv[key] = process.env[key];
    process.env[key] = SMTP_ENV[key];
  }
  const control = {
    now: new Date(isoNow),
    transport: fakeTransport(),
    transportsCreated: 0,
    setNow(iso) { control.now = new Date(iso); },
    advanceMinutes(minutes) { control.now = new Date(control.now.getTime() + minutes * 60000); },
  };
  emailRuntime.now = () => new Date(control.now.getTime());
  emailRuntime.createTransport = () => {
    control.transportsCreated += 1;
    return control.transport;
  };
  return control;
}

export function restoreEmailRuntime() {
  emailRuntime.now = original.now;
  emailRuntime.createTransport = original.createTransport;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  jest.restoreAllMocks();
}

/** Registers the email schedule on a stub node-cron and returns the registration and its callback. */
export function registerOnStubCron() {
  const cron = { schedule: jest.fn((expression, callback, options) => ({ expression, callback, options })) };
  const task = registerEmailSchedule(cron);
  return { cron, task, tick: () => task.callback() };
}

let counter = 0;
const unique = () => {
  counter += 1;
  return `${counter}-${Date.now()}`;
};

export const makeArea = (overrides = {}) =>
  db.area.create({
    areaName: `Area ${unique()}`,
    areaLogo: "https://example.com/logo.png",
    noticeEmail: "Pick up keys at the fleet office.",
    ...overrides,
  });

export const makeDriver = () =>
  db.driver.create({
    firstName: "Jane",
    lastName: "Doe",
    licenseState: "OK",
    licenseExpireDate: "2028-01-01",
    approvedDate: "2025-01-01",
    status: "approved",
  });

export const makeDestination = () =>
  db.destination.create({
    destinationName: `Dest ${unique()}`,
    addressLine: "100 Main St",
    city: "Oklahoma City",
    state: "OK",
    zipCode: "73159",
    roundTripMiles: 120.5,
    status: "active",
  });

let vehicleCounter = 0;
export const makeVehicle = (areaId, overrides = {}) => {
  vehicleCounter += 1;
  return db.vehicle.create({
    make: "Toyota",
    model: "Sienna",
    year: 2024,
    vin: `F9VIN${String(vehicleCounter).padStart(12, "0")}`,
    purchasedDate: "2024-01-01",
    color: "White",
    passengers: 8,
    plateNumber: `F9P${String(vehicleCounter).padStart(5, "0")}`,
    plateExpireMonth: 6,
    designatedParking: "Lot A, row 3",
    areaId,
    ...overrides,
  });
};

/** Lower-feature records every email test needs: an area with a vehicle, a driver, a destination, and a requestor. */
export async function seedTrip() {
  const area = await makeArea();
  const vehicle = await makeVehicle(area.id);
  const driver = await makeDriver();
  const destination = await makeDestination();
  const requestor = await createUser({ role: "requestor", areaId: null });
  return { area, vehicle, driver, destination, requestor };
}

export const makeRequest = (seed, overrides = {}) =>
  db.reservationRequest.create({
    requestorUserId: seed.requestor.id,
    areaId: seed.area.id,
    driverId: seed.driver.id,
    destinationId: seed.destination.id,
    destinationCity: null,
    estimatedMiles: null,
    departureDate: "2026-12-01",
    departureTime: "08:00",
    returnDate: "2026-12-01",
    returnTime: "17:00",
    passengers: 4,
    purpose: "Conference shuttle",
    noteType: null,
    noteText: null,
    status: "requested",
    vehicleId: null,
    statusReason: null,
    ...overrides,
  });

const auth = (req, token) => (token ? req.set("Authorization", `Bearer ${token}`) : req);
export const changeStatus = (token, id, body) =>
  auth(request(app).put(`/vehicle-t6/reservation-requests/${id}/status`), token).send(body);
export const cancelRequest = (token, id) => auth(request(app).put(`/vehicle-t6/reservation-requests/${id}/cancel`), token);
export const sendNow = (token, { body, query } = {}) => {
  const req = auth(request(app).post("/vehicle-t6/reservation-emails/send-now"), token);
  if (query) req.query(query);
  return body ? req.send(body) : req;
};
export const authMe = (token) => auth(request(app).get("/vehicle-t6/auth/me"), token);

/** Plain job rows for comparisons. */
export const emailRows = async (where = {}) =>
  (await db.reservationEmail.findAll({ where, order: [["id", "ASC"]] })).map((row) => row.get({ plain: true }));

/** Captures every logger message while a block runs. */
export function captureLogs(logger) {
  const lines = [];
  for (const level of ["error", "warn", "info", "http", "debug"]) {
    jest.spyOn(logger, level).mockImplementation((message) => {
      lines.push({ level, message: String(message) });
      return logger;
    });
  }
  return lines;
}
