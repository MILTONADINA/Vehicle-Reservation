/**
 * Feature 4 — Vehicle Management
 * Spec: features/feature-4-vehicle-management.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import AreaServices from "../src/services/areaServices.js";
import VehicleServices from "../src/services/vehicleServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/areaServices.js", () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("../src/services/vehicleServices.js", () => ({
  default: { getOptions: vi.fn(), getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const athletics = { id: 1, areaName: "Athletics", areaLogo: "https://example.org/a.png", noticeEmail: "Athletics desk." };
const maintenance = { id: 2, areaName: "Maintenance", areaLogo: "https://example.org/b.png", noticeEmail: "Shop." };
const options = {
  makes: ["Chevrolet", "Ford"],
  modelsByMake: { Chevrolet: ["Express"], Ford: ["Transit", "Escape"] },
};
const transit = {
  id: 10,
  make: "Ford",
  model: "Transit",
  year: 2022,
  vin: "1FTBR1C80MKA12345",
  purchasedDate: "2022-06-15",
  color: "White",
  passengers: 12,
  plateNumber: "OC-4521",
  plateExpireMonth: 8,
  designatedParking: "Support Central lot, spot B3",
  areaId: 1,
};
const express = {
  id: 11,
  make: "Chevrolet",
  model: "Express",
  year: 2021,
  vin: "1GCWGAFG5M1234567",
  purchasedDate: "2021-03-01",
  color: "Blue",
  passengers: 8,
  plateNumber: "OC-1001",
  plateExpireMonth: 4,
  designatedParking: "North lot A1",
  areaId: 2,
};
const fleet = [express, transit];

const account = (role, areaId = null) => ({ userId: 7, email: `${role}@oc.edu`, firstName: "Test", lastName: "User", role, areaId });
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

function mockLists(list = fleet) {
  VehicleServices.getAll.mockResolvedValue({ data: list });
  VehicleServices.getOptions.mockResolvedValue({ data: options });
  AreaServices.getAll.mockResolvedValue({ data: [athletics, maintenance] });
}

async function openVehicles(role, areaId = null, list = fleet) {
  Utils.setStore("user", { ...account(role, areaId), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role, areaId) });
  mockLists(list);
  return mountApp("/vehicles");
}

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const dialogOpen = (id) => !!byTestId(id)?.closest(".v-overlay")?.classList.contains("v-overlay--active");
const bodyText = () => document.body.textContent;
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
const fieldValue = (id) => document.querySelector(`[data-testid="${id}"] input, [data-testid="${id}"] textarea`)?.value;
const rows = (wrapper) => wrapper.findAll('[data-testid="vehicle-row"]');

async function fillValidVehicle() {
  await choose("vehicle-make", "Ford");
  await choose("vehicle-model", "Transit");
  await fill("vehicle-year", "2022");
  await fill("vehicle-vin", "1FTBR1C80MKA99999");
  await fill("vehicle-purchased-date", "2022-06-15");
  await fill("vehicle-color", "White");
  await fill("vehicle-passengers", "12");
  await fill("vehicle-plate-number", "OC-9999");
  await choose("vehicle-plate-expire-month", 8);
  await fill("vehicle-parking", "Lot B");
  await choose("vehicle-area", 1);
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

describe("Feature 4 — Vehicle Management", () => {
  describe("US-4.1 — View vehicles", () => {
    it("Vehicles page shows allowed records and actions", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      mockLists();
      let wrapper = await mountApp("/");
      await wrapper.find('[data-testid="nav-vehicles"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("vehicles");
      expect(wrapper.find("h1").text()).toBe("Vehicles");
      expect(rows(wrapper)).toHaveLength(2);
      expect(rows(wrapper)[0].text()).toContain("Chevrolet");
      expect(rows(wrapper)[0].text()).toContain("Express");
      expect(rows(wrapper)[0].text()).toContain("Maintenance");
      expect(rows(wrapper)[1].text()).toContain("Ford");
      expect(rows(wrapper)[1].text()).toContain("Athletics");
      expect(wrapper.find('[data-testid="add-vehicle"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="edit-vehicle"]')).toHaveLength(2);
      expect(wrapper.findAll('[data-testid="delete-vehicle"]')).toHaveLength(2);
      wrapper.unmount();
      mounted.pop();

      wrapper = await openVehicles("area_admin", 2, [express]);
      expect(rows(wrapper)).toHaveLength(1);
      expect(wrapper.find('[data-testid="add-vehicle"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="edit-vehicle"]')).toHaveLength(1);
      expect(wrapper.findAll('[data-testid="delete-vehicle"]')).toHaveLength(1);
    });

    it("Vehicles navigation requires an allowed role", async () => {
      const wrapper = await mountApp("/vehicles");
      expect(router.currentRoute.value.name).toBe("login");
      expect(VehicleServices.getAll).not.toHaveBeenCalled();
      expect(wrapper.findAll('[data-testid="vehicle-row"]')).toHaveLength(0);
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Requestor and maintenance are sent Home from Vehicles", async () => {
      for (const role of ["requestor", "maintenance"]) {
        Utils.setStore("user", { ...account(role), token: "session-token" });
        AuthServices.me.mockResolvedValue({ data: account(role) });
        const wrapper = await mountApp("/");
        expect(wrapper.find('[data-testid="nav-vehicles"]').exists()).toBe(false);
        await router.push("/vehicles");
        await flushPromises();
        expect(router.currentRoute.value.name).toBe("home");
        expect(VehicleServices.getAll).not.toHaveBeenCalled();
        wrapper.unmount();
        mounted.pop();
      }
    });

    it("Vehicles page distinguishes loading empty and failed states", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      let resolveList;
      VehicleServices.getAll.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
      VehicleServices.getOptions.mockResolvedValue({ data: options });
      AreaServices.getAll.mockResolvedValue({ data: [athletics, maintenance] });
      const wrapper = await mountApp("/vehicles");
      expect(wrapper.find('[data-testid="vehicles-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("No vehicles found.");

      resolveList({ data: [] });
      await flushPromises();
      expect(wrapper.find('[data-testid="vehicles-loading"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("No vehicles found.");
      expect(rows(wrapper)).toHaveLength(0);
    });

    it("Vehicle list failure does not show an empty list", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      VehicleServices.getOptions.mockResolvedValue({ data: options });
      AreaServices.getAll.mockResolvedValue({ data: [athletics] });
      VehicleServices.getAll.mockRejectedValueOnce(apiError(500, "Vehicle request failed."));
      const wrapper = await mountApp("/vehicles");
      expect(wrapper.text()).toContain("Vehicle request failed.");
      expect(wrapper.text()).not.toContain("No vehicles found.");
      wrapper.unmount();
      mounted.pop();

      VehicleServices.getAll.mockRejectedValueOnce(new Error("Network Error"));
      const again = await mountApp("/vehicles");
      expect(again.text()).toContain("Vehicles could not be loaded.");
      expect(again.text()).not.toContain("No vehicles found.");
      expect(rows(again)).toHaveLength(0);
    });
  });

  describe("US-4.2 — Add a vehicle", () => {
    it("Add vehicle opens the specified form", async () => {
      const wrapper = await openVehicles("admin");
      await wrapper.find('[data-testid="add-vehicle"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("vehicle-dialog")).toBe(true);
      expect(bodyText()).toContain("Add vehicle");
      expect(bodyText()).toContain("Make");
      expect(bodyText()).toContain("Model");
      expect(bodyText()).toContain("Year");
      expect(bodyText()).toContain("VIN");
      expect(bodyText()).toContain("Purchased date");
      expect(bodyText()).toContain("Color");
      expect(bodyText()).toContain("Passengers");
      expect(bodyText()).toContain("Plate number");
      expect(bodyText()).toContain("Plate expire month");
      expect(bodyText()).toContain("Designated parking");
      expect(bodyText()).toContain("Area");
      expect(byTestId("save-vehicle").textContent).toContain("Save");
      expect(byTestId("cancel-vehicle").textContent).toContain("Cancel");
    });

    it("Saving a vehicle updates the list", async () => {
      const wrapper = await openVehicles("admin");
      await wrapper.find('[data-testid="add-vehicle"]').trigger("click");
      await flushPromises();
      await fillValidVehicle();
      let resolveSave;
      VehicleServices.create.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
      const created = { ...transit, id: 12, vin: "1FTBR1C80MKA99999", plateNumber: "OC-9999", designatedParking: "Lot B" };
      VehicleServices.getAll.mockResolvedValue({ data: [...fleet, created] });
      await click("save-vehicle");
      await click("save-vehicle");
      expect(VehicleServices.create).toHaveBeenCalledTimes(1);
      expect(VehicleServices.create).toHaveBeenCalledWith({
        make: "Ford",
        model: "Transit",
        year: 2022,
        vin: "1FTBR1C80MKA99999",
        purchasedDate: "2022-06-15",
        color: "White",
        passengers: 12,
        plateNumber: "OC-9999",
        plateExpireMonth: 8,
        designatedParking: "Lot B",
        areaId: 1,
      });
      expect(byTestId("save-vehicle").disabled).toBe(true);

      resolveSave({ data: created });
      await flushPromises();
      expect(dialogOpen("vehicle-dialog")).toBe(false);
      expect(VehicleServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(3);
    });

    it("Cancel leaves vehicle records unchanged", async () => {
      const wrapper = await openVehicles("admin");
      await wrapper.find('[data-testid="add-vehicle"]').trigger("click");
      await flushPromises();
      await fill("vehicle-color", "Draft");
      await click("save-vehicle");
      expect(bodyText()).toContain("Invalid vehicle data.");
      await click("cancel-vehicle");
      expect(VehicleServices.create).not.toHaveBeenCalled();
      expect(dialogOpen("vehicle-dialog")).toBe(false);

      await wrapper.find('[data-testid="add-vehicle"]').trigger("click");
      await flushPromises();
      expect(fieldValue("vehicle-color")).toBe("");
      expect(bodyText()).not.toContain("Invalid vehicle data.");
      await click("cancel-vehicle");

      await rows(wrapper)[1].find('[data-testid="edit-vehicle"]').trigger("click");
      await flushPromises();
      await fill("vehicle-color", "Changed");
      await click("cancel-vehicle");
      expect(VehicleServices.update).not.toHaveBeenCalled();
      await rows(wrapper)[1].find('[data-testid="edit-vehicle"]').trigger("click");
      await flushPromises();
      expect(fieldValue("vehicle-color")).toBe("White");
      expect(fieldValue("vehicle-vin")).toBe(transit.vin);
    });

    it("Vehicle form rejects invalid fields before submitting", async () => {
      const wrapper = await openVehicles("admin");
      await wrapper.find('[data-testid="add-vehicle"]').trigger("click");
      await flushPromises();
      await click("save-vehicle");
      expect(bodyText()).toContain("Invalid vehicle data.");
      expect(dialogOpen("vehicle-dialog")).toBe(true);
      expect(VehicleServices.create).not.toHaveBeenCalled();
    });

    it("Failed vehicle save keeps the dialog open", async () => {
      const wrapper = await openVehicles("admin");
      await wrapper.find('[data-testid="add-vehicle"]').trigger("click");
      await flushPromises();
      await fillValidVehicle();
      VehicleServices.create.mockRejectedValueOnce(apiError(409, "VIN is already in use."));
      await click("save-vehicle");
      expect(dialogOpen("vehicle-dialog")).toBe(true);
      expect(bodyText()).toContain("VIN is already in use.");
      expect(fieldValue("vehicle-color")).toBe("White");

      VehicleServices.create.mockRejectedValueOnce(new Error("Network Error"));
      await click("save-vehicle");
      expect(dialogOpen("vehicle-dialog")).toBe(true);
      expect(bodyText()).toContain("Vehicle could not be saved.");
      expect(rows(wrapper)).toHaveLength(2);
    });
  });

  describe("US-4.3 — Edit a vehicle", () => {
    it("Edit vehicle opens with the current values", async () => {
      const wrapper = await openVehicles("admin");
      await rows(wrapper)[1].find('[data-testid="edit-vehicle"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("vehicle-dialog")).toBe(true);
      expect(bodyText()).toContain("Edit vehicle");
      expect(fieldValue("vehicle-vin")).toBe(transit.vin);
      expect(fieldValue("vehicle-color")).toBe("White");
      expect(fieldValue("vehicle-year")).toBe("2022");
      expect(fieldValue("vehicle-purchased-date")).toBe("2022-06-15");
      expect(fieldValue("vehicle-plate-number")).toBe("OC-4521");
      expect(fieldValue("vehicle-parking")).toBe(transit.designatedParking);
      expect(byTestId("save-vehicle").textContent).toContain("Save");
      expect(byTestId("cancel-vehicle").textContent).toContain("Cancel");
    });

    it("Saving an edited vehicle refreshes the list", async () => {
      const wrapper = await openVehicles("admin");
      await rows(wrapper)[1].find('[data-testid="edit-vehicle"]').trigger("click");
      await flushPromises();
      await fill("vehicle-color", "Silver");
      VehicleServices.update.mockResolvedValue({ data: { ...transit, color: "Silver" } });
      VehicleServices.getAll.mockResolvedValue({ data: [express, { ...transit, color: "Silver" }] });
      await click("save-vehicle");
      expect(VehicleServices.update).toHaveBeenCalledWith(10, expect.objectContaining({ color: "Silver", make: "Ford", model: "Transit", areaId: 1 }));
      expect(dialogOpen("vehicle-dialog")).toBe(false);
      expect(VehicleServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)[1].text()).toContain("Silver");
    });
  });

  describe("US-4.4 — Delete a vehicle", () => {
    it("Delete vehicle requires confirmation", async () => {
      const wrapper = await openVehicles("admin");
      await rows(wrapper)[0].find('[data-testid="delete-vehicle"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("delete-dialog")).toBe(true);
      expect(bodyText()).toContain("Delete vehicle");
      expect(bodyText()).toContain("Delete this vehicle?");
      expect(byTestId("confirm-delete").textContent).toContain("Delete");
      expect(byTestId("cancel-delete").textContent).toContain("Cancel");
    });

    it("Confirmed vehicle deletion refreshes the list", async () => {
      const wrapper = await openVehicles("admin");
      await rows(wrapper)[0].find('[data-testid="delete-vehicle"]').trigger("click");
      await flushPromises();
      let resolveDelete;
      VehicleServices.remove.mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }));
      VehicleServices.getAll.mockResolvedValue({ data: [transit] });
      await click("confirm-delete");
      await click("confirm-delete");
      expect(VehicleServices.remove).toHaveBeenCalledTimes(1);
      expect(VehicleServices.remove).toHaveBeenCalledWith(11);
      expect(byTestId("confirm-delete").disabled).toBe(true);

      resolveDelete({ data: { message: "Vehicle deleted." } });
      await flushPromises();
      expect(dialogOpen("delete-dialog")).toBe(false);
      expect(VehicleServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(1);
      expect(rows(wrapper)[0].text()).toContain("Ford");
    });

    it("Failed vehicle deletion preserves the dialog and row", async () => {
      const wrapper = await openVehicles("admin");
      await rows(wrapper)[0].find('[data-testid="delete-vehicle"]').trigger("click");
      await flushPromises();
      VehicleServices.remove.mockRejectedValueOnce(apiError(500, "Vehicle request failed."));
      await click("confirm-delete");
      expect(dialogOpen("delete-dialog")).toBe(true);
      expect(bodyText()).toContain("Vehicle request failed.");
      expect(rows(wrapper)).toHaveLength(2);

      VehicleServices.remove.mockRejectedValueOnce(new Error("Network Error"));
      await click("confirm-delete");
      expect(dialogOpen("delete-dialog")).toBe(true);
      expect(bodyText()).toContain("Vehicle could not be deleted.");
      expect(rows(wrapper)).toHaveLength(2);
    });

    it("Cancel closes delete without a request", async () => {
      const wrapper = await openVehicles("admin");
      await rows(wrapper)[0].find('[data-testid="delete-vehicle"]').trigger("click");
      await flushPromises();
      await click("cancel-delete");
      expect(VehicleServices.remove).not.toHaveBeenCalled();
      expect(dialogOpen("delete-dialog")).toBe(false);
      expect(rows(wrapper)).toHaveLength(2);
    });
  });
});
