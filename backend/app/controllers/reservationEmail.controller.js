import logger from "../config/logger.js";
import { EmailConfigurationError, CONFIGURATION_INVALID, RUN_FAILED } from "../reservationEmails/emailConfig.js";
import { runEmailCycle } from "../reservationEmails/emailCycle.js";

const controller = {};

// Admin-only Send now: runs the same cycle as the cron job. The body and query are ignored on purpose,
// so no caller can override recipients, eligibility, retry timing, or terminal states.
controller.sendNow = async (_req, res) => {
  try {
    const { queued, sent, retryScheduled, failed, skipped } = await runEmailCycle();
    return res.status(200).send({ queued, sent, retryScheduled, failed, skipped });
  } catch (error) {
    logger.error(error instanceof EmailConfigurationError ? CONFIGURATION_INVALID : RUN_FAILED);
    return res.status(500).send({ message: "Emails could not be processed." });
  }
};

export default controller;
