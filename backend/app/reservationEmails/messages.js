import { CAMPUS_TIME_ZONE } from "./campusClock.js";

// The same display labels the request-processing page uses (Feature 8).
export const STATUS_LABELS = {
  requested: "Requested",
  awaiting_vehicle: "Awaiting Vehicle",
  reserved: "Reserved",
  returned: "Returned",
  cancelled: "Cancelled",
};

const label = (status) => STATUS_LABELS[status] ?? status;
const schedule = (date, time) => `${date} ${time ?? "Whole day"} (${CAMPUS_TIME_ZONE})`;
const vehicleLine = (vehicle) =>
  vehicle
    ? `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}, ${vehicle.color}, plate ${vehicle.plateNumber}`
    : "Vehicle: Not assigned";

/** Plain-text status-change message for a committed transition. */
export function statusChangeMessage({ request, area, vehicle, oldStatus, newStatus, changedAt }) {
  const lines = [
    `Reservation: #${request.id}`,
    `Status changed: ${label(oldStatus)} -> ${label(newStatus)}`,
    `Changed at: ${changedAt.toISOString()}`,
    `Area: ${area.areaName}`,
    `Departure: ${schedule(request.departureDate, request.departureTime)}`,
    `Return: ${schedule(request.returnDate, request.returnTime)}`,
    vehicleLine(vehicle),
  ];
  if (newStatus === "cancelled" && request.statusReason !== null && request.statusReason !== undefined) {
    lines.push(`Reason: ${request.statusReason}`);
  }
  return { subject: `Reservation #${request.id} — ${label(newStatus)}`, body: lines.join("\n") };
}

/** Plain-text day-before reminder: the area's saved instructions, then the trip facts. */
export function pickupReminderMessage({ request, area, vehicle }) {
  const details = [
    `Reservation: #${request.id}`,
    `Area: ${area.areaName}`,
    `Departure: ${schedule(request.departureDate, request.departureTime)}`,
    `Return: ${schedule(request.returnDate, request.returnTime)}`,
    vehicleLine(vehicle),
    `Pickup parking: ${vehicle.designatedParking}`,
    `Passengers: ${request.passengers}`,
    `Purpose: ${request.purpose}`,
  ];
  return {
    subject: `Reservation #${request.id} — vehicle pickup reminder`,
    body: `${area.noticeEmail}\n\n${details.join("\n")}`,
  };
}
