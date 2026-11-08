import { CAMPUS_TIME_ZONE, addCalendarDays, campusParts } from "../reservationEmails/campusClock.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const campusDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAMPUS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const campusWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPUS_TIME_ZONE,
  weekday: "short",
});

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** True when value is a real calendar YYYY-MM-DD. */
export function isCalendarDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** True when the calendar date is a Monday (Gregorian weekday of that date). */
export function isMonday(date) {
  if (!isCalendarDate(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1;
}

function campusWallParts(instant) {
  const parts = Object.fromEntries(
    campusDateTimeFormatter.formatToParts(instant).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Instant for an America/Chicago wall-clock date and time.
 * Request departure/return times are campus wall times, not UTC.
 */
export function campusDateTimeToMs(date, hour, minute, second = 0, ms = 0) {
  const [year, month, day] = date.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  for (let i = 0; i < 3; i += 1) {
    const shown = campusWallParts(new Date(utc));
    const asUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second, ms);
    const want = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    utc += want - asUtc;
  }
  return utc;
}

export function campusWeekday(instant) {
  return WEEKDAY[campusWeekdayFormatter.format(instant)];
}

/** Monday YYYY-MM-DD of the America/Chicago week containing the instant. */
export function mondayOf(instant = new Date()) {
  const { date } = campusParts(instant);
  const weekday = campusWeekday(instant);
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addCalendarDays(date, offset);
}

/** Milliseconds for a request bound in America/Chicago (null time = whole-day start/end). */
export function requestBoundMs(date, time, { endOfDay = false } = {}) {
  if (typeof time === "string" && TIME_PATTERN.test(time)) {
    const [hour, minute] = time.split(":").map(Number);
    if (endOfDay) return campusDateTimeToMs(date, hour, minute, 59, 999);
    return campusDateTimeToMs(date, hour, minute, 0, 0);
  }
  if (endOfDay) return campusDateTimeToMs(date, 23, 59, 59, 999);
  return campusDateTimeToMs(date, 0, 0, 0, 0);
}

export function weekBoundsMs(weekStart) {
  const weekEnd = addCalendarDays(weekStart, 6);
  return {
    weekStart,
    weekEnd,
    startMs: requestBoundMs(weekStart, null),
    endMs: requestBoundMs(weekEnd, null, { endOfDay: true }),
  };
}

export function requestOverlapsWeek(request, weekStartMs, weekEndMs) {
  const startMs = requestBoundMs(request.departureDate, request.departureTime);
  const endMs = requestBoundMs(request.returnDate, request.returnTime, { endOfDay: true });
  return startMs <= weekEndMs && endMs >= weekStartMs;
}

export function effectiveReturnMs(request) {
  return requestBoundMs(request.returnDate, request.returnTime, { endOfDay: true });
}

export { addCalendarDays, CAMPUS_TIME_ZONE };
