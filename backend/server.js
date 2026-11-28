import routes from "./app/routes/index.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import db from "./app/models/index.js";
import cron from "node-cron";
import logger from "./app/config/logger.js";
import { safeMessage } from "./app/authorization/authorization.js";
import { registerEmailSchedule } from "./app/reservationEmails/emailSchedule.js";

const shouldAlterSchema =
  process.env.SEQUELIZE_SYNC_ALTER === "true" ||
  process.env.SEQUELIZE_SYNC_ALTER === "1" ||
  (process.env.NODE_ENV === "development" && process.env.SEQUELIZE_SYNC_ALTER !== "false");

const syncOptions = shouldAlterSchema ? { alter: true } : {};

if (process.env.NODE_ENV !== "test") {
  db.sequelize
    .sync(syncOptions)
    .then(() => {
      if (syncOptions.alter) {
        logger.info("Database sync completed with alter: true.");
      }
      // One in-process email job per backend process (Feature 9); tests never start it.
      registerEmailSchedule(cron);
    })
    .catch((err) => {
      logger.error(`Database sync failed: ${err.message}`);
      process.exit(1);
    });
}

const app = express();

app.use(morgan("combined", { stream: logger.stream }));

app.use(
  cors({
    origin: "http://localhost:8082",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/vehicle-t6", routes);

// Unknown API paths answer in JSON like every other API error.
app.use("/vehicle-t6", (_req, res) => {
  res.status(404).send({ message: "Not found." });
});

// Last-resort error handler: malformed JSON is a client error; anything else is logged and hidden.
const errorHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === "entity.parse.failed") {
    return res.status(400).send({ message: "Invalid JSON." });
  }
  // Other body-parser client errors (too large, unsupported encoding) keep their own 4xx status.
  if (err?.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).send({ message: "Invalid request." });
  }
  logger.error(`Unhandled request error: ${safeMessage(err)}`);
  return res.status(500).send({ message: "Server error." });
};
app.use(errorHandler);

const PORT = process.env.PORT || 3200;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`Vehicle Reservation API running on port ${PORT}`);
  });
}

export { logger, errorHandler };
export default app;
