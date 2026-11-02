/**
 * Feature 5 — Driver Management
 * Spec: features/feature-5-driver-management.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import DriverServices from "../src/services/driverServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/driverServices.js", () => ({
  default: { getOptions: vi.fn(), getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const licenseStates = ["AL", "OK", "TX"];
const jordan = {
  id: 1,
  firstName: "Jordan",
  lastName: "Lee",
  licenseState: "OK",
  licenseExpireDate: "2028-06-30",
  approvedDate: "2026-01-15",
  status: "approved",
};
const avery = {
  id: 2,
  firstName: "Avery",
  lastName: "Smith",
  licenseState: "TX",
  licenseExpireDate: "2027-12-01",
  approvedDate: "2025-08-20",
  status: "approved",
};
const roster = [jordan, avery];

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

function mockLists(list = roster) {
  DriverServices.getAll.mockResolvedValue({ data: list });
  DriverServices.getOptions.mockResolvedValue({ data: { licenseStates } });
}

async function openDrivers(role, areaId = null, list = roster) {
  Utils.setStore("user", { ...account(role, areaId), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role, areaId) });
  mockLists(list);
  return mountApp("/drivers");
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
const rows = (wrapper) => wrapper.findAll('[data-testid="driver-row"]');

async function fillValidDriver() {
  await fill("driver-first", "Casey");
  await fill("driver-last", "Nguyen");
  await choose("driver-license-state", "OK");
  await fill("driver-license-expire", "2029-01-01");
  await fill("driver-approved", "2026-02-01");
  await choose("driver-status", "approved");
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

describe("Feature 5 — Driver Management", () => {
  describe("US-5.1 — View drivers", () => {
    it("Drivers page shows allowed records and actions", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      mockLists();
      let wrapper = await mountApp("/");
      await wrapper.find('[data-testid="nav-drivers"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("drivers");
      expect(wrapper.find("h1").text()).toBe("Drivers");
      expect(rows(wrapper)).toHaveLength(2);
      expect(rows(wrapper)[0].text()).toContain("Jordan");
      expect(rows(wrapper)[0].text()).toContain("Lee");
      expect(rows(wrapper)[0].text()).toContain("OK");
      expect(rows(wrapper)[0].text()).toContain("2028-06-30");
      expect(rows(wrapper)[0].text()).toContain("2026-01-15");
      expect(rows(wrapper)[0].text()).toContain("approved");
      expect(wrapper.find('[data-testid="add-driver"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="edit-driver"]')).toHaveLength(2);
      expect(wrapper.findAll('[data-testid="delete-driver"]')).toHaveLength(2);
      wrapper.unmount();
      mounted.pop();

      wrapper = await openDrivers("area_admin", 2);
      expect(rows(wrapper)).toHaveLength(2);
      expect(wrapper.find('[data-testid="add-driver"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="edit-driver"]')).toHaveLength(2);
      expect(wrapper.findAll('[data-testid="delete-driver"]')).toHaveLength(2);
    });

    it("Drivers navigation requires an allowed role", async () => {
      const wrapper = await mountApp("/drivers");
      expect(router.currentRoute.value.name).toBe("login");
      expect(DriverServices.getAll).not.toHaveBeenCalled();
      expect(wrapper.findAll('[data-testid="driver-row"]')).toHaveLength(0);
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Requestor and maintenance are sent Home from Drivers", async () => {
      for (const role of ["requestor", "maintenance"]) {
        Utils.setStore("user", { ...account(role), token: "session-token" });
        AuthServices.me.mockResolvedValue({ data: account(role) });
        const wrapper = await mountApp("/");
        expect(wrapper.find('[data-testid="nav-drivers"]').exists()).toBe(false);
        await router.push("/drivers");
        await flushPromises();
        expect(router.currentRoute.value.name).toBe("home");
        expect(DriverServices.getAll).not.toHaveBeenCalled();
        wrapper.unmount();
        mounted.pop();
      }
    });

    it("Drivers page distinguishes loading empty and failed states", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      let resolveList;
      DriverServices.getAll.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
      DriverServices.getOptions.mockResolvedValue({ data: { licenseStates } });
      const wrapper = await mountApp("/drivers");
      expect(wrapper.find('[data-testid="drivers-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("No drivers found.");

      resolveList({ data: [] });
      await flushPromises();
      expect(wrapper.find('[data-testid="drivers-loading"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("No drivers found.");
      expect(rows(wrapper)).toHaveLength(0);
    });

    it("Driver list failure does not show an empty list", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      DriverServices.getOptions.mockResolvedValue({ data: { licenseStates } });
      DriverServices.getAll.mockRejectedValueOnce(apiError(500, "Driver request failed."));
      const wrapper = await mountApp("/drivers");
      expect(wrapper.text()).toContain("Driver request failed.");
      expect(wrapper.text()).not.toContain("No drivers found.");
      wrapper.unmount();
      mounted.pop();

      DriverServices.getAll.mockRejectedValueOnce(new Error("Network Error"));
      const again = await mountApp("/drivers");
      expect(again.text()).toContain("Drivers could not be loaded.");
      expect(again.text()).not.toContain("No drivers found.");
      expect(rows(again)).toHaveLength(0);
    });
  });

  describe("US-5.2 — Add a driver", () => {
    it("Add driver opens the specified form", async () => {
      const wrapper = await openDrivers("admin");
      await wrapper.find('[data-testid="add-driver"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("driver-dialog")).toBe(true);
      expect(bodyText()).toContain("Add driver");
      expect(bodyText()).toContain("First name");
      expect(bodyText()).toContain("Last name");
      expect(bodyText()).toContain("License state");
      expect(bodyText()).toContain("License expire date");
      expect(bodyText()).toContain("Approved date");
      expect(bodyText()).toContain("Status");
      expect(byTestId("save-driver").textContent).toContain("Save");
      expect(byTestId("cancel-driver").textContent).toContain("Cancel");
      expect(fieldValue("driver-first")).toBe("");
    });

    it("Saving a driver updates the list", async () => {
      const wrapper = await openDrivers("admin");
      await wrapper.find('[data-testid="add-driver"]').trigger("click");
      await flushPromises();
      await fillValidDriver();
      let resolveSave;
      DriverServices.create.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
      const created = {
        id: 3,
        firstName: "Casey",
        lastName: "Nguyen",
        licenseState: "OK",
        licenseExpireDate: "2029-01-01",
        approvedDate: "2026-02-01",
        status: "approved",
      };
      DriverServices.getAll.mockResolvedValue({ data: [...roster, created] });
      await click("save-driver");
      await click("save-driver");
      expect(DriverServices.create).toHaveBeenCalledTimes(1);
      expect(DriverServices.create).toHaveBeenCalledWith({
        firstName: "Casey",
        lastName: "Nguyen",
        licenseState: "OK",
        licenseExpireDate: "2029-01-01",
        approvedDate: "2026-02-01",
        status: "approved",
      });
      expect(byTestId("save-driver").disabled).toBe(true);

      resolveSave({ data: created });
      await flushPromises();
      expect(dialogOpen("driver-dialog")).toBe(false);
      expect(DriverServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(3);
    });

    it("Cancel leaves driver records unchanged", async () => {
      const wrapper = await openDrivers("admin");
      await wrapper.find('[data-testid="add-driver"]').trigger("click");
      await flushPromises();
      await fill("driver-first", "Draft");
      await click("save-driver");
      expect(bodyText()).toContain("Invalid driver data.");
      await click("cancel-driver");
      expect(DriverServices.create).not.toHaveBeenCalled();
      expect(dialogOpen("driver-dialog")).toBe(false);

      await wrapper.find('[data-testid="add-driver"]').trigger("click");
      await flushPromises();
      expect(fieldValue("driver-first")).toBe("");
      expect(bodyText()).not.toContain("Invalid driver data.");
      await click("cancel-driver");

      await rows(wrapper)[0].find('[data-testid="edit-driver"]').trigger("click");
      await flushPromises();
      await fill("driver-first", "Changed");
      await click("cancel-driver");
      expect(DriverServices.update).not.toHaveBeenCalled();
      await rows(wrapper)[0].find('[data-testid="edit-driver"]').trigger("click");
      await flushPromises();
      expect(fieldValue("driver-first")).toBe("Jordan");
      expect(fieldValue("driver-last")).toBe("Lee");
    });

    it("Driver form rejects invalid fields before submitting", async () => {
      const wrapper = await openDrivers("admin");
      await wrapper.find('[data-testid="add-driver"]').trigger("click");
      await flushPromises();
      await click("save-driver");
      expect(bodyText()).toContain("Invalid driver data.");
      expect(dialogOpen("driver-dialog")).toBe(true);
      expect(DriverServices.create).not.toHaveBeenCalled();
    });

    it("Failed driver save keeps the dialog open", async () => {
      const wrapper = await openDrivers("admin");
      await wrapper.find('[data-testid="add-driver"]').trigger("click");
      await flushPromises();
      await fillValidDriver();
      DriverServices.create.mockRejectedValueOnce(apiError(500, "Driver request failed."));
      await click("save-driver");
      expect(dialogOpen("driver-dialog")).toBe(true);
      expect(bodyText()).toContain("Driver request failed.");
      expect(fieldValue("driver-first")).toBe("Casey");

      DriverServices.create.mockRejectedValueOnce(new Error("Network Error"));
      await click("save-driver");
      expect(dialogOpen("driver-dialog")).toBe(true);
      expect(bodyText()).toContain("Driver could not be saved.");
      expect(rows(wrapper)).toHaveLength(2);
    });
  });

  describe("US-5.3 — Edit a driver", () => {
    it("Edit driver opens with the current values", async () => {
      const wrapper = await openDrivers("admin");
      await rows(wrapper)[0].find('[data-testid="edit-driver"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("driver-dialog")).toBe(true);
      expect(bodyText()).toContain("Edit driver");
      expect(fieldValue("driver-first")).toBe("Jordan");
      expect(fieldValue("driver-last")).toBe("Lee");
      expect(fieldValue("driver-license-expire")).toBe("2028-06-30");
      expect(fieldValue("driver-approved")).toBe("2026-01-15");
      expect(byTestId("save-driver").textContent).toContain("Save");
      expect(byTestId("cancel-driver").textContent).toContain("Cancel");
    });

    it("Saving an edited driver refreshes the list", async () => {
      const wrapper = await openDrivers("admin");
      await rows(wrapper)[0].find('[data-testid="edit-driver"]').trigger("click");
      await flushPromises();
      await fill("driver-first", "Jamie");
      DriverServices.update.mockResolvedValue({ data: { ...jordan, firstName: "Jamie" } });
      DriverServices.getAll.mockResolvedValue({ data: [{ ...jordan, firstName: "Jamie" }, avery] });
      await click("save-driver");
      expect(DriverServices.update).toHaveBeenCalledWith(1, expect.objectContaining({
        firstName: "Jamie",
        lastName: "Lee",
        licenseState: "OK",
        status: "approved",
      }));
      expect(dialogOpen("driver-dialog")).toBe(false);
      expect(DriverServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)[0].text()).toContain("Jamie");
    });
  });

  describe("US-5.4 — Delete a driver", () => {
    it("Delete driver requires confirmation", async () => {
      const wrapper = await openDrivers("admin");
      await rows(wrapper)[0].find('[data-testid="delete-driver"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("delete-driver-dialog")).toBe(true);
      expect(bodyText()).toContain("Delete driver");
      expect(bodyText()).toContain("Delete this driver?");
      expect(byTestId("confirm-delete-driver").textContent).toContain("Delete");
      expect(byTestId("cancel-delete-driver").textContent).toContain("Cancel");
    });

    it("Confirmed driver deletion refreshes the list", async () => {
      const wrapper = await openDrivers("admin");
      await rows(wrapper)[0].find('[data-testid="delete-driver"]').trigger("click");
      await flushPromises();
      let resolveDelete;
      DriverServices.remove.mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }));
      DriverServices.getAll.mockResolvedValue({ data: [avery] });
      await click("confirm-delete-driver");
      await click("confirm-delete-driver");
      expect(DriverServices.remove).toHaveBeenCalledTimes(1);
      expect(DriverServices.remove).toHaveBeenCalledWith(1);
      expect(byTestId("confirm-delete-driver").disabled).toBe(true);

      resolveDelete({ data: { message: "Driver deleted." } });
      await flushPromises();
      expect(dialogOpen("delete-driver-dialog")).toBe(false);
      expect(DriverServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(1);
      expect(rows(wrapper)[0].text()).toContain("Avery");
    });

    it("Failed driver deletion preserves the dialog and row", async () => {
      const wrapper = await openDrivers("admin");
      await rows(wrapper)[0].find('[data-testid="delete-driver"]').trigger("click");
      await flushPromises();
      DriverServices.remove.mockRejectedValueOnce(apiError(500, "Driver request failed."));
      await click("confirm-delete-driver");
      expect(dialogOpen("delete-driver-dialog")).toBe(true);
      expect(bodyText()).toContain("Driver request failed.");
      expect(rows(wrapper)).toHaveLength(2);

      DriverServices.remove.mockRejectedValueOnce(new Error("Network Error"));
      await click("confirm-delete-driver");
      expect(dialogOpen("delete-driver-dialog")).toBe(true);
      expect(bodyText()).toContain("Driver could not be deleted.");
      expect(rows(wrapper)).toHaveLength(2);
    });

    it("Cancel closes driver delete without a request", async () => {
      const wrapper = await openDrivers("admin");
      await rows(wrapper)[0].find('[data-testid="delete-driver"]').trigger("click");
      await flushPromises();
      await click("cancel-delete-driver");
      expect(DriverServices.remove).not.toHaveBeenCalled();
      expect(dialogOpen("delete-driver-dialog")).toBe(false);
      expect(rows(wrapper)).toHaveLength(2);
    });
  });
});
