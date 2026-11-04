// Campus calendar helpers. Reminder eligibility uses America/Chicago calendar dates,
// never the server's default zone or an exact 24-hour interval.
export const CAMPUS_TIME_ZONE = "America/Chicago";
export const REMINDER_START_HOUR = 9;

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAMPUS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The campus-local calendar date (YYYY-MM-DD) and hour for an instant. */
export function campusParts(instant) {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** A YYYY-MM-DD calendar date moved by whole days (calendar arithmetic, not 24-hour steps). */
export function addCalendarDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return moved.toISOString().slice(0, 10);
}

/**
 * The departure date whose pickup reminders may be prepared at this instant, or null outside
 * the window (09:00 until local midnight on the day before departure).
 */
export function reminderDepartureDate(instant) {
  const { date, hour } = campusParts(instant);
  return hour >= REMINDER_START_HOUR ? addCalendarDays(date, 1) : null;
}
