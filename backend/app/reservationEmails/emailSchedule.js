import logger from "../config/logger.js";
import { EmailConfigurationError, CONFIGURATION_INVALID, RUN_FAILED } from "./emailConfig.js";
import { runEmailCycle } from "./emailCycle.js";
import { CAMPUS_TIME_ZONE } from "./campusClock.js";

export const EMAIL_CRON_EXPRESSION = "* * * * *";

/** Runs one scheduled cycle; failures are logged by fixed code and never escape to the HTTP server. */
export async function runScheduledCycle(runCycle = runEmailCycle) {
  try {
    return await runCycle();
  } catch (error) {
    if (error instanceof EmailConfigurationError) logger.warn(CONFIGURATION_INVALID);
    else logger.error(RUN_FAILED);
    return null;
  }
}

/** Registers the single in-process email job: every minute, campus time zone, the shared delivery cycle. */
export function registerEmailSchedule(cron, runCycle = runEmailCycle) {
  return cron.schedule(EMAIL_CRON_EXPRESSION, () => runScheduledCycle(runCycle), { timezone: CAMPUS_TIME_ZONE });
}
