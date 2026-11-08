/**
 * Feature 12 — Mileage & Service Logs
 * Spec: features/feature-12-mileage-service-logs.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import MaintenanceLogServices from "../src/services/maintenanceLogServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/maintenanceLogServices.js", () => ({
  default: {
    listVehicles: vi.fn(),
    listMileage: vi.fn(),
    createMileage: vi.fn(),
    listService: vi.fn(),
    createService: vi.fn(),
  },
}));

const transit = {
  id: 3,
  make: "Ford",
  model: "Transit",
  year: 2022,
  plateNumber: "OC-4521",
  color: "White",
  areaId: 1,
};
const express = {
  id: 4,
  make: "Chevrolet",
  model: "Express",
  year: 2021,
  plateNumber: "OC-1001",
  color: "Blue",
  areaId: 2,
};
const fleet = [express, transit];
const mileageRow = {
  id: 1,
  vehicleId: 3,
  logDate: "2026-10-28",
  mileage: 45210,
  loggedByUserId: 12,
  createdAt: "2026-10-28T15:00:00.000Z",
};
const serviceRow = {
  id: 2,
  vehicleId: 3,
  serviceDate: "2026-10-28",
  serviceType: "oil_change",
  note: "Synthetic oil",
  loggedByUserId: 12,
  createdAt: "2026-10-28T15:05:00.000Z",
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

function mockVehiclePage(list = fleet, mileage = [mileageRow], services = [serviceRow]) {
  MaintenanceLogServices.listVehicles.mockResolvedValue({ data: list });
  MaintenanceLogServices.listMileage.mockResolvedValue({ data: mileage });
  MaintenanceLogServices.listService.mockResolvedValue({ data: services });
}

async function openMaintenance(role = "maintenance", list = fleet) {
  Utils.setStore("user", { ...account(role), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role) });
  MaintenanceLogServices.listVehicles.mockResolvedValue({ data: list });
  return mountApp("/maintenance");
}

async function openVehicleLogs(role = "maintenance") {
  Utils.setStore("user", { ...account(role), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role) });
  mockVehiclePage();
  return mountApp("/maintenance/vehicles/3");
}

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const bodyText = () => document.body.textContent || "";
const dialogOpen = (id) => !!byTestId(id)?.closest(".v-overlay")?.classList.contains("v-overlay--active");
const rows = (wrapper) => wrapper.findAll('[data-testid="maintenance-vehicle-row"]');

async function click(id) {
  const node = byTestId(id);
  if (!node) throw new Error(`no element with data-testid=${id}`);
  node.click();
  await flushPromises();
}

async function fill(id, value) {
  const node = document.querySelector(`[data-testid="${id}"] input, [data-testid="${id}"] textarea`);
  if (!node) throw new Error(`no input with data-testid=${id}`);
  node.value = value;
  node.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
}

async function choose(id, value) {
  const field = byTestId(id);
  if (!field) throw new Error(`no element with data-testid=${id}`);
  let instance = field.__vueParentComponent;
  while (instance) {
    const props = instance.props || {};
    if ("modelValue" in props && Array.isArray(props.items)) {
      instance.emit("update:modelValue", value);
      await flushPromises();
      return;
    }
    instance = instance.parent;
  }
  throw new Error(`could not set select ${id}`);
}

beforeEach(async () => {
  localStorage.clear();
  vi.resetAllMocks();
  await router.push("/login");
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.querySelectorAll(".v-overlay-container").forEach((node) => node.remove());
});

describe("Feature 12 — Mileage & Service Logs", () => {
  describe("US-12.1 — View vehicles for logging", () => {
    it("Maintenance page shows vehicle rows", async () => {
      Utils.setStore("user", { ...account("maintenance"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("maintenance") });
      MaintenanceLogServices.listVehicles.mockResolvedValue({ data: fleet });
      let wrapper = await mountApp("/");
      await wrapper.find('[data-testid="nav-maintenance"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("maintenance");
      expect(wrapper.find("h1").text()).toBe("Maintenance");
      expect(rows(wrapper)).toHaveLength(2);
      expect(wrapper.text()).toContain("Ford");
      expect(wrapper.text()).toContain("Transit");
      expect(wrapper.text()).toContain("2022");
      expect(wrapper.text()).toContain("OC-4521");
      wrapper.unmount();
      mounted.pop();

      wrapper = await openMaintenance("admin");
      expect(rows(wrapper)).toHaveLength(2);
    });

    it("Maintenance page distinguishes loading empty and failed states", async () => {
      Utils.setStore("user", { ...account("maintenance"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("maintenance") });
      let resolveList;
      MaintenanceLogServices.listVehicles.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
      const wrapper = await mountApp("/maintenance");
      expect(wrapper.find('[data-testid="maintenance-vehicles-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("No vehicles found.");

      resolveList({ data: [] });
      await flushPromises();
      expect(wrapper.find('[data-testid="maintenance-vehicles-loading"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("No vehicles found.");
    });

    it("Maintenance vehicle list failure does not show empty", async () => {
      Utils.setStore("user", { ...account("maintenance"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("maintenance") });
      MaintenanceLogServices.listVehicles.mockRejectedValue(apiError(500, "Mileage request failed."));
      let wrapper = await mountApp("/maintenance");
      expect(wrapper.text()).toContain("Mileage request failed.");
      expect(wrapper.text()).not.toContain("No vehicles found.");
      wrapper.unmount();
      mounted.pop();

      MaintenanceLogServices.listVehicles.mockRejectedValue(apiError(500));
      wrapper = await mountApp("/maintenance");
      expect(wrapper.text()).toContain("Vehicles could not be loaded.");
      expect(wrapper.text()).not.toContain("No vehicles found.");
    });
  });

  describe("US-12.2 — Log vehicle mileage", () => {
    it("Add mileage opens the specified form", async () => {
      const wrapper = await openVehicleLogs();
      await wrapper.find('[data-testid="add-mileage"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("mileage-dialog")).toBe(true);
      expect(bodyText()).toContain("Add mileage");
      expect(bodyText()).toContain("Date");
      expect(bodyText()).toContain("Mileage");
      expect(byTestId("mileage-save").textContent).toContain("Save");
      expect(byTestId("mileage-cancel").textContent).toContain("Cancel");
    });

    it("Saving mileage refreshes the list", async () => {
      const wrapper = await openVehicleLogs();
      await wrapper.find('[data-testid="add-mileage"]').trigger("click");
      await flushPromises();
      await fill("mileage-date-input", "2026-10-29");
      await fill("mileage-value-input", "45300");
      let resolveSave;
      MaintenanceLogServices.createMileage.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
      const created = { ...mileageRow, id: 9, logDate: "2026-10-29", mileage: 45300 };
      MaintenanceLogServices.listMileage.mockResolvedValue({ data: [created, mileageRow] });
      await click("mileage-save");
      await click("mileage-save");
      expect(MaintenanceLogServices.createMileage).toHaveBeenCalledTimes(1);
      expect(MaintenanceLogServices.createMileage).toHaveBeenCalledWith("3", {
        logDate: "2026-10-29",
        mileage: 45300,
      });
      expect(byTestId("mileage-save").disabled).toBe(true);

      resolveSave({ data: created });
      await flushPromises();
      expect(dialogOpen("mileage-dialog")).toBe(false);
      expect(wrapper.findAll('[data-testid="mileage-row"]')).toHaveLength(2);
      expect(wrapper.text()).toContain("45300");
    });

    it("Failed mileage save keeps the dialog open", async () => {
      const wrapper = await openVehicleLogs();
      await wrapper.find('[data-testid="add-mileage"]').trigger("click");
      await flushPromises();
      await fill("mileage-date-input", "2026-10-29");
      await fill("mileage-value-input", "40000");
      MaintenanceLogServices.createMileage.mockRejectedValueOnce(
        apiError(409, "Mileage cannot be lower than the latest reading.")
      );
      await click("mileage-save");
      expect(dialogOpen("mileage-dialog")).toBe(true);
      expect(bodyText()).toContain("Mileage cannot be lower than the latest reading.");

      MaintenanceLogServices.createMileage.mockRejectedValueOnce(new Error("Network Error"));
      await click("mileage-save");
      expect(dialogOpen("mileage-dialog")).toBe(true);
      expect(bodyText()).toContain("Mileage could not be saved.");
      expect(wrapper.findAll('[data-testid="mileage-row"]')).toHaveLength(1);
    });
  });

  describe("US-12.3 — Log a vehicle service", () => {
    it("Add service opens the specified form", async () => {
      const wrapper = await openVehicleLogs();
      await wrapper.find('[data-testid="add-service"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("service-dialog")).toBe(true);
      expect(bodyText()).toContain("Add service");
      expect(bodyText()).toContain("Date");
      expect(bodyText()).toContain("Service type");
      expect(bodyText()).toContain("Note");
      expect(byTestId("service-save").textContent).toContain("Save");
      expect(byTestId("service-cancel").textContent).toContain("Cancel");
    });

    it("Saving a service log refreshes the list", async () => {
      const wrapper = await openVehicleLogs();
      await wrapper.find('[data-testid="add-service"]').trigger("click");
      await flushPromises();
      await fill("service-date-input", "2026-10-29");
      await choose("service-type-input", "repair");
      await fill("service-note-input", "Brake pads");
      let resolveSave;
      MaintenanceLogServices.createService.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
      const created = {
        id: 8,
        vehicleId: 3,
        serviceDate: "2026-10-29",
        serviceType: "repair",
        note: "Brake pads",
        loggedByUserId: 12,
        createdAt: "2026-10-29T12:00:00.000Z",
      };
      MaintenanceLogServices.listService.mockResolvedValue({ data: [created, serviceRow] });
      await click("service-save");
      await click("service-save");
      expect(MaintenanceLogServices.createService).toHaveBeenCalledTimes(1);
      expect(MaintenanceLogServices.createService).toHaveBeenCalledWith("3", {
        serviceDate: "2026-10-29",
        serviceType: "repair",
        note: "Brake pads",
      });
      expect(byTestId("service-save").disabled).toBe(true);

      resolveSave({ data: created });
      await flushPromises();
      expect(dialogOpen("service-dialog")).toBe(false);
      expect(wrapper.findAll('[data-testid="service-row"]')).toHaveLength(2);
      expect(wrapper.text()).toContain("Repair");
      expect(wrapper.text()).toContain("Brake pads");
    });

    it("Failed service save keeps the dialog open", async () => {
      const wrapper = await openVehicleLogs();
      await wrapper.find('[data-testid="add-service"]').trigger("click");
      await flushPromises();
      await fill("service-date-input", "2026-10-29");
      await choose("service-type-input", "repair");
      MaintenanceLogServices.createService.mockRejectedValueOnce(apiError(400, "Invalid service log data."));
      await click("service-save");
      expect(dialogOpen("service-dialog")).toBe(true);
      expect(bodyText()).toContain("Invalid service log data.");

      MaintenanceLogServices.createService.mockRejectedValueOnce(new Error("Network Error"));
      await click("service-save");
      expect(dialogOpen("service-dialog")).toBe(true);
      expect(bodyText()).toContain("Service log could not be saved.");
      expect(wrapper.findAll('[data-testid="service-row"]')).toHaveLength(1);
    });
  });

  describe("US-12.4 — Restrict mileage and service log access", () => {
    it("Maintenance navigation requires an allowed role", async () => {
      Utils.removeItem("user");
      await mountApp("/maintenance");
      expect(router.currentRoute.value.name).toBe("login");
    });

    it("Requestor and area admin are sent Home from Maintenance", async () => {
      for (const role of ["requestor", "area_admin"]) {
        Utils.setStore("user", { ...account(role, role === "area_admin" ? 1 : null), token: "session-token" });
        AuthServices.me.mockResolvedValue({ data: account(role, role === "area_admin" ? 1 : null) });
        const wrapper = await mountApp("/maintenance");
        expect(router.currentRoute.value.name).toBe("home");
        expect(wrapper.find('[data-testid="nav-maintenance"]').exists()).toBe(false);
        wrapper.unmount();
        mounted.pop();
      }
    });
  });
});
