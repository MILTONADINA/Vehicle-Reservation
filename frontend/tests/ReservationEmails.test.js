/**
 * Feature 9 — Reservation Emails (Frontend): the admin-only Send now control on /reservation-requests.
 * Spec: features/feature-9-reservation-emails.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import ReservationRequestServices from "../src/services/reservationRequestServices.js";
import ReservationEmailServices from "../src/services/reservationEmailServices.js";
import AreaServices from "../src/services/areaServices.js";
import DriverServices from "../src/services/driverServices.js";
import DestinationServices from "../src/services/destinationServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/reservationRequestServices.js", () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), cancel: vi.fn(), getCandidateVehicles: vi.fn(), changeStatus: vi.fn() },
}));
vi.mock("../src/services/reservationEmailServices.js", () => ({ default: { sendNow: vi.fn() } }));
vi.mock("../src/services/areaServices.js", () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("../src/services/driverServices.js", () => ({
  default: { getOptions: vi.fn(), getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("../src/services/destinationServices.js", () => ({
  default: { getOptions: vi.fn(), getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const area = { id: 1, areaName: "Athletics", areaLogo: "https://example.org/logo.png", noticeEmail: "Return clean." };
const driver = { id: 1, firstName: "Jordan", lastName: "Lee", licenseState: "OK", licenseExpireDate: "2028-06-30", approvedDate: "2026-01-15", status: "approved" };
const destination = { id: 1, destinationName: "Oklahoma City Airport", addressLine: "7100 Terminal Drive", city: "Oklahoma City", state: "OK", zipCode: "73159", roundTripMiles: 120.5, status: "active" };
const requestRow = {
  id: 1, requestorUserId: 99, areaId: 1, driverId: 1,
  destinationId: 1, destinationCity: null, estimatedMiles: null,
  departureDate: "2026-11-10", departureTime: "08:30",
  returnDate: "2026-11-10", returnTime: "17:00",
  passengers: 4, purpose: "Conference shuttle",
  noteType: null, noteText: null,
  status: "requested", vehicleId: null, statusReason: null,
};
const counts = { queued: 2, sent: 3, retryScheduled: 1, failed: 0, skipped: 0 };

const account = (role, areaId = null) => ({ userId: 7, email: `${role}@oc.edu`, firstName: "Test", lastName: "User", role, areaId });
const apiError = (status, message) => ({ response: { status, data: message ? { message } : {} } });

const mounted = [];
async function openAs(role, areaId = null) {
  Utils.setStore("user", { ...account(role, areaId), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role, areaId) });
  ReservationRequestServices.getAll.mockResolvedValue({ data: [requestRow] });
  AreaServices.getAll.mockResolvedValue({ data: [area] });
  DriverServices.getAll.mockResolvedValue({ data: [driver] });
  DestinationServices.getAll.mockResolvedValue({ data: [destination] });
  await router.push("/reservation-requests");
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [vuetify, router] } });
  mounted.push(wrapper);
  await flushPromises();
  return wrapper;
}

const sendNowButton = (wrapper) => wrapper.find('[data-testid="send-now"]');
const resultText = (wrapper) => wrapper.find('[data-testid="send-now-result"]');
const rowsText = (wrapper) => wrapper.findAll('[data-testid="request-row"]').map((row) => row.text());

beforeEach(async () => {
  localStorage.clear();
  vi.resetAllMocks();
  await router.push("/login");
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.querySelectorAll(".v-overlay-container").forEach((node) => node.remove());
});

describe("Feature 9 — Reservation Emails", () => {
  describe("US-9.4 — Send due reservation emails now", () => {
    it("Send now control is visible only to admin", async () => {
      const admin = await openAs("admin");
      expect(router.currentRoute.value.path).toBe("/reservation-requests");
      const button = sendNowButton(admin);
      expect(button.exists()).toBe(true);
      expect(button.text()).toBe("Send now");
      // Beside the heading, outside the request rows.
      expect(button.element.closest("table")).toBeNull();
      expect(button.element.closest(".d-flex").parentElement.querySelector("h1").textContent).toBe("Reservation requests");
      expect(admin.findAll('[data-testid="request-row"]').every((row) => !row.find('[data-testid="send-now"]').exists())).toBe(true);
      expect(admin.text()).not.toMatch(/email/i);
      admin.unmount();
      mounted.splice(0);

      for (const [role, areaId] of [["area_admin", 1], ["requestor", null]]) {
        const wrapper = await openAs(role, areaId);
        expect(router.currentRoute.value.path).toBe("/reservation-requests");
        expect(sendNowButton(wrapper).exists()).toBe(false);
        wrapper.unmount();
        mounted.splice(0);
      }

      // Maintenance is sent Home by the existing guard and sees no email control anywhere.
      const maintenance = await openAs("maintenance");
      expect(router.currentRoute.value.path).toBe("/");
      expect(sendNowButton(maintenance).exists()).toBe(false);
      expect(maintenance.text()).not.toMatch(/send now|email/i);
      expect(ReservationEmailServices.sendNow).not.toHaveBeenCalled();
      expect(router.getRoutes().some((route) => /email/i.test(route.path))).toBe(false);
    });

    it("Send now shows progress and returned counts", async () => {
      const wrapper = await openAs("admin");
      const before = rowsText(wrapper);
      let resolve;
      ReservationEmailServices.sendNow.mockReturnValue(new Promise((done) => { resolve = done; }));

      await sendNowButton(wrapper).trigger("click");
      await flushPromises();
      const pending = sendNowButton(wrapper);
      expect(pending.attributes("disabled")).toBeDefined();
      expect(pending.find(".v-progress-circular").exists()).toBe(true);
      await pending.trigger("click");
      pending.element.click();
      await flushPromises();
      expect(ReservationEmailServices.sendNow).toHaveBeenCalledTimes(1);
      expect(ReservationEmailServices.sendNow).toHaveBeenCalledWith();

      resolve({ data: counts });
      await flushPromises();
      expect(sendNowButton(wrapper).attributes("disabled")).toBeUndefined();
      const labels = ["Queued: 2", "Sent: 3", "Retry scheduled: 1", "Failed: 0", "Skipped: 0"];
      expect(wrapper.findAll('[data-testid^="send-now-"]').filter((n) => n.attributes("data-testid") !== "send-now-result").map((n) => n.text())).toEqual(labels);
      expect(resultText(wrapper).text()).not.toMatch(/@|inbox|delivered|subject/i);
      expect(rowsText(wrapper)).toEqual(before);
      expect(ReservationRequestServices.getAll).toHaveBeenCalledTimes(1);
      expect(ReservationRequestServices.changeStatus).not.toHaveBeenCalled();

      // Zero counts are shown as numbers too.
      ReservationEmailServices.sendNow.mockResolvedValue({ data: { queued: 0, sent: 0, retryScheduled: 0, failed: 0, skipped: 0 } });
      await sendNowButton(wrapper).trigger("click");
      await flushPromises();
      expect(resultText(wrapper).text()).toContain("Queued: 0");
      expect(resultText(wrapper).text()).toContain("Retry scheduled: 0");
    });

    it("Send now failure allows another attempt", async () => {
      const wrapper = await openAs("admin");
      const before = rowsText(wrapper);

      ReservationEmailServices.sendNow.mockRejectedValueOnce(apiError(500, "Emails could not be processed."));
      await sendNowButton(wrapper).trigger("click");
      await flushPromises();
      expect(wrapper.find('[data-testid="send-now-error"]').text()).toBe("Emails could not be processed.");
      expect(sendNowButton(wrapper).attributes("disabled")).toBeUndefined();

      ReservationEmailServices.sendNow.mockRejectedValueOnce(apiError(500, "Mail relay is busy."));
      await sendNowButton(wrapper).trigger("click");
      await flushPromises();
      expect(wrapper.find('[data-testid="send-now-error"]').text()).toBe("Mail relay is busy.");

      ReservationEmailServices.sendNow.mockRejectedValueOnce(new Error("Network Error"));
      await sendNowButton(wrapper).trigger("click");
      await flushPromises();
      expect(wrapper.find('[data-testid="send-now-error"]').text()).toBe("Emails could not be processed.");
      expect(resultText(wrapper).exists()).toBe(false);
      expect(sendNowButton(wrapper).attributes("disabled")).toBeUndefined();

      // The request list and its status controls are intact.
      expect(rowsText(wrapper)).toEqual(before);
      expect(wrapper.find('[data-testid="request-row"] [data-testid="status-change"]').exists()).toBe(true);
      expect(ReservationRequestServices.getAll).toHaveBeenCalledTimes(1);

      // A retry that succeeds replaces the error with counts.
      ReservationEmailServices.sendNow.mockResolvedValueOnce({ data: counts });
      await sendNowButton(wrapper).trigger("click");
      await flushPromises();
      expect(wrapper.find('[data-testid="send-now-error"]').exists()).toBe(false);
      expect(resultText(wrapper).text()).toContain("Sent: 3");
    });
  });
});
