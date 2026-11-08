const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date YYYY-MM-DD moved by whole days using UTC calendar arithmetic. */
export function addCalendarDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return moved.toISOString().slice(0, 10);
}

/** True when value is a real calendar YYYY-MM-DD. */
export function isCalendarDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** True when the calendar date is a Monday (UTC weekday). */
export function isMonday(date) {
  if (!isCalendarDate(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 1;
}

/** Monday YYYY-MM-DD of the week containing the given instant (UTC calendar date). */
export function mondayOf(instant = new Date()) {
  const y = instant.getUTCFullYear();
  const m = instant.getUTCMonth();
  const d = instant.getUTCDate();
  const weekday = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0 Sun .. 6 Sat
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addCalendarDays(
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    offset
  );
}

/** Milliseconds at local calendar date + HH:mm, or whole-day start/end bounds. */
export function requestBoundMs(date, time, { endOfDay = false } = {}) {
  const [year, month, day] = date.split("-").map(Number);
  if (typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    const [hour, minute] = time.split(":").map(Number);
    return Date.UTC(year, month - 1, day, hour, minute, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }
  if (endOfDay) return Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
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
