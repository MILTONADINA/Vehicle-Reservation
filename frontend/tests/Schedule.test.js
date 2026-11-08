/**
 * Feature 11 — Weekly Vehicle Schedule (Frontend)
 * Spec: features/feature-11-weekly-vehicle-schedule.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import ScheduleServices from "../src/services/scheduleServices.js";
import AreaServices from "../src/services/areaServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/scheduleServices.js", () => ({
  default: { getSchedule: vi.fn(), getServiceQueue: vi.fn() },
}));
vi.mock("../src/services/areaServices.js", () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const scheduleItem = {
  id: 10,
  areaId: 2,
  status: "reserved",
  departureDate: "2026-11-03",
  departureTime: "09:00",
  returnDate: "2026-11-05",
  returnTime: "17:00",
  requestorUserId: 8,
  requestorName: "Avery Reed",
  vehicleId: 3,
  vehicleLabel: "Ford Transit · OC-4521",
};
const awaitingItem = {
  ...scheduleItem,
  id: 11,
  status: "awaiting_vehicle",
  vehicleId: null,
  vehicleLabel: null,
};
const checkInItem = {
  ...scheduleItem,
  id: 12,
  departureDate: "2026-10-01",
  returnDate: "2026-10-02",
};

const account = (role, areaId = null) => ({
  userId: 7, email: `${role}@oc.edu`, firstName: "Test", lastName: "User", role, areaId,
});
const apiError = (status, message) => ({ response: { status, data: message ? { message } : {} } });

const mounted = [];
async function mountApp(path) {
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [vuetify, router] } });
  mounted.push(wrapper);
  await flushPromises();
  return wrapper;
}

function mockHappy(weekStart = "2026-11-02") {
  ScheduleServices.getSchedule.mockResolvedValue({
    data: { weekStart, weekEnd: "2026-11-08", items: [scheduleItem, awaitingItem] },
  });
  ScheduleServices.getServiceQueue.mockResolvedValue({
    data: { needVehicle: [awaitingItem], needCheckIn: [checkInItem] },
  });
  AreaServices.getAll.mockResolvedValue({
    data: [{ id: 1, areaName: "Athletics", areaLogo: "https://example.org/a.png", noticeEmail: "x" }],
  });
}

async function openSchedule(role = "admin", areaId = null) {
  Utils.setStore("user", { ...account(role, areaId), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role, areaId) });
  mockHappy();
  return mountApp("/schedule");
}

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

beforeEach(async () => {
  localStorage.clear();
  vi.resetAllMocks();
  await router.push("/login");
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.querySelectorAll(".v-overlay-container").forEach((node) => node.remove());
});

describe("Feature 11 — Schedule page", () => {
  describe("US-11.1 — View the weekly schedule", () => {
    it("Schedule page shows the week items", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      mockHappy();
      let wrapper = await mountApp("/");
      await wrapper.find('[data-testid="nav-schedule"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("schedule");
      expect(wrapper.find("h1").text()).toBe("Schedule");
      expect(wrapper.findAll('[data-testid="schedule-row"]')).toHaveLength(2);
      expect(wrapper.text()).toContain("reserved");
      expect(wrapper.text()).toContain("2026-11-03 09:00");
      expect(wrapper.text()).toContain("Ford Transit · OC-4521");
      expect(wrapper.text()).toContain("No vehicle");
      wrapper.unmount();
      mounted.pop();

      wrapper = await openSchedule("area_admin", 2);
      expect(wrapper.findAll('[data-testid="schedule-row"]')).toHaveLength(2);
      expect(wrapper.find('[data-testid="schedule-area-filter"]').exists()).toBe(false);
    });

    it("Schedule page distinguishes loading empty and failed states", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      AreaServices.getAll.mockResolvedValue({ data: [] });
      ScheduleServices.getServiceQueue.mockResolvedValue({ data: { needVehicle: [], needCheckIn: [] } });
      let resolveSchedule;
      ScheduleServices.getSchedule.mockReturnValue(new Promise((resolve) => { resolveSchedule = resolve; }));
      const wrapper = await mountApp("/schedule");
      expect(wrapper.find('[data-testid="schedule-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("No reservations this week.");

      resolveSchedule({ data: { weekStart: "2026-11-02", weekEnd: "2026-11-08", items: [] } });
      await flushPromises();
      expect(wrapper.find('[data-testid="schedule-loading"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("No reservations this week.");
    });

    it("Schedule failure does not show an empty week", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      AreaServices.getAll.mockResolvedValue({ data: [] });
      ScheduleServices.getServiceQueue.mockResolvedValue({ data: { needVehicle: [], needCheckIn: [] } });
      ScheduleServices.getSchedule.mockRejectedValue(apiError(500, "Schedule request failed."));
      let wrapper = await mountApp("/schedule");
      expect(wrapper.text()).toContain("Schedule request failed.");
      expect(wrapper.text()).not.toContain("No reservations this week.");
      wrapper.unmount();
      mounted.pop();

      ScheduleServices.getSchedule.mockRejectedValue(apiError(500));
      wrapper = await mountApp("/schedule");
      expect(wrapper.text()).toContain("Schedule could not be loaded.");
      expect(wrapper.text()).not.toContain("No reservations this week.");
    });
  });

  describe("US-11.2 — View the service queue", () => {
    it("Service queue section shows both lists", async () => {
      const wrapper = await openSchedule("admin");
      expect(wrapper.find('[data-testid="service-queue-section"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="need-vehicle-row"]')).toHaveLength(1);
      expect(wrapper.findAll('[data-testid="need-checkin-row"]')).toHaveLength(1);
      expect(wrapper.text()).toContain("Need vehicle");
      expect(wrapper.text()).toContain("Need check-in");
    });

    it("Service queue empty and failed states", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      AreaServices.getAll.mockResolvedValue({ data: [] });
      ScheduleServices.getSchedule.mockResolvedValue({
        data: { weekStart: "2026-11-02", weekEnd: "2026-11-08", items: [] },
      });
      ScheduleServices.getServiceQueue.mockResolvedValue({ data: { needVehicle: [], needCheckIn: [] } });
      let wrapper = await mountApp("/schedule");
      expect(wrapper.text()).toContain("No requests need a vehicle.");
      expect(wrapper.text()).toContain("No requests need check-in.");
      wrapper.unmount();
      mounted.pop();

      ScheduleServices.getServiceQueue.mockRejectedValue(apiError(500));
      wrapper = await mountApp("/schedule");
      expect(wrapper.text()).toContain("Service queue could not be loaded.");
      expect(wrapper.text()).not.toContain("No requests need a vehicle.");
      expect(wrapper.text()).not.toContain("No requests need check-in.");
    });
  });

  describe("US-11.3 — Move between weeks on the schedule", () => {
    it("Next and previous week change the range", async () => {
      const wrapper = await openSchedule("admin");
      ScheduleServices.getSchedule.mockClear();
      ScheduleServices.getSchedule.mockResolvedValue({
        data: { weekStart: "2026-11-09", weekEnd: "2026-11-15", items: [] },
      });
      await wrapper.find('[data-testid="next-week"]').trigger("click");
      await flushPromises();
      expect(ScheduleServices.getSchedule).toHaveBeenCalledWith({ weekStart: "2026-11-09" });

      ScheduleServices.getSchedule.mockResolvedValue({
        data: { weekStart: "2026-11-02", weekEnd: "2026-11-08", items: [] },
      });
      await wrapper.find('[data-testid="previous-week"]').trigger("click");
      await flushPromises();
      expect(ScheduleServices.getSchedule).toHaveBeenCalledWith({ weekStart: "2026-11-02" });
    });
  });

  describe("US-11.4 — Restrict schedule and queue access", () => {
    it("Schedule navigation requires an allowed role", async () => {
      const wrapper = await mountApp("/schedule");
      expect(router.currentRoute.value.name).toBe("login");
      expect(ScheduleServices.getSchedule).not.toHaveBeenCalled();
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Requestor and maintenance are sent Home from Schedule", async () => {
      for (const role of ["requestor", "maintenance"]) {
        Utils.setStore("user", { ...account(role), token: "session-token" });
        AuthServices.me.mockResolvedValue({ data: account(role) });
        const wrapper = await mountApp("/");
        expect(wrapper.find('[data-testid="nav-schedule"]').exists()).toBe(false);
        await router.push("/schedule");
        await flushPromises();
        expect(router.currentRoute.value.name).toBe("home");
        expect(ScheduleServices.getSchedule).not.toHaveBeenCalled();
        wrapper.unmount();
        mounted.pop();
      }
    });
  });
});
