/**
 * Feature 6 — Destination Management
 * Spec: features/feature-6-destination-management.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import DestinationServices from "../src/services/destinationServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/destinationServices.js", () => ({
  default: { getOptions: vi.fn(), getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const states = ["AL", "OK", "TX"];
const oklahoma = {
  id: 1,
  destinationName: "Oklahoma City Airport",
  addressLine: "7100 Terminal Drive",
  city: "Oklahoma City",
  state: "OK",
  zipCode: "73159",
  roundTripMiles: 120.5,
  status: "active",
};
const tulsa = {
  id: 2,
  destinationName: "Tulsa Downtown",
  addressLine: "100 South Main Street",
  city: "Tulsa",
  state: "OK",
  zipCode: "74103",
  roundTripMiles: 210,
  status: "active",
};
const roster = [oklahoma, tulsa];

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
  DestinationServices.getAll.mockResolvedValue({ data: list });
  DestinationServices.getOptions.mockResolvedValue({ data: { states } });
}

async function openDestinations(role, areaId = null, list = roster) {
  Utils.setStore("user", { ...account(role, areaId), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role, areaId) });
  mockLists(list);
  return mountApp("/destinations");
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
const rows = (wrapper) => wrapper.findAll('[data-testid="destination-row"]');

async function fillValidDestination() {
  await fill("destination-name", "Norman Campus");
  await fill("destination-address", "1100 E 14th St");
  await fill("destination-city", "Norman");
  await choose("destination-state", "OK");
  await fill("destination-zip", "73019");
  await fill("destination-miles", "45.5");
  await choose("destination-status", "active");
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

describe("Feature 6 — Destination Management", () => {
  describe("US-6.1 — View destinations", () => {
    it("Destinations page shows allowed records and actions", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      mockLists();
      let wrapper = await mountApp("/");
      await wrapper.find('[data-testid="nav-destinations"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("destinations");
      expect(wrapper.find("h1").text()).toBe("Destinations");
      expect(rows(wrapper)).toHaveLength(2);
      expect(rows(wrapper)[0].text()).toContain("Oklahoma City Airport");
      expect(rows(wrapper)[0].text()).toContain("7100 Terminal Drive");
      expect(rows(wrapper)[0].text()).toContain("Oklahoma City");
      expect(rows(wrapper)[0].text()).toContain("OK");
      expect(rows(wrapper)[0].text()).toContain("73159");
      expect(rows(wrapper)[0].text()).toContain("120.5");
      expect(rows(wrapper)[0].text()).toContain("active");
      expect(wrapper.find('[data-testid="add-destination"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="edit-destination"]')).toHaveLength(2);
      expect(wrapper.findAll('[data-testid="delete-destination"]')).toHaveLength(2);
      wrapper.unmount();
      mounted.pop();

      wrapper = await openDestinations("area_admin", 2);
      expect(rows(wrapper)).toHaveLength(2);
      expect(wrapper.find('[data-testid="add-destination"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="edit-destination"]')).toHaveLength(2);
      expect(wrapper.findAll('[data-testid="delete-destination"]')).toHaveLength(2);
    });

    it("Destinations navigation requires an allowed role", async () => {
      const wrapper = await mountApp("/destinations");
      expect(router.currentRoute.value.name).toBe("login");
      expect(DestinationServices.getAll).not.toHaveBeenCalled();
      expect(wrapper.findAll('[data-testid="destination-row"]')).toHaveLength(0);
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Requestor and maintenance are sent Home from Destinations", async () => {
      for (const role of ["requestor", "maintenance"]) {
        Utils.setStore("user", { ...account(role), token: "session-token" });
        AuthServices.me.mockResolvedValue({ data: account(role) });
        const wrapper = await mountApp("/");
        expect(wrapper.find('[data-testid="nav-destinations"]').exists()).toBe(false);
        await router.push("/destinations");
        await flushPromises();
        expect(router.currentRoute.value.name).toBe("home");
        expect(DestinationServices.getAll).not.toHaveBeenCalled();
        wrapper.unmount();
        mounted.pop();
      }
    });

    it("Destinations page distinguishes loading empty and failed states", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      let resolveList;
      DestinationServices.getAll.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
      DestinationServices.getOptions.mockResolvedValue({ data: { states } });
      const wrapper = await mountApp("/destinations");
      expect(wrapper.find('[data-testid="destinations-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("No destinations found.");

      resolveList({ data: [] });
      await flushPromises();
      expect(wrapper.find('[data-testid="destinations-loading"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("No destinations found.");
      expect(rows(wrapper)).toHaveLength(0);
    });

    it("Destination list failure does not show an empty list", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      DestinationServices.getOptions.mockResolvedValue({ data: { states } });
      DestinationServices.getAll.mockRejectedValueOnce(apiError(500, "Destination request failed."));
      const wrapper = await mountApp("/destinations");
      expect(wrapper.text()).toContain("Destination request failed.");
      expect(wrapper.text()).not.toContain("No destinations found.");
      wrapper.unmount();
      mounted.pop();

      DestinationServices.getAll.mockRejectedValueOnce(new Error("Network Error"));
      const again = await mountApp("/destinations");
      expect(again.text()).toContain("Destinations could not be loaded.");
      expect(again.text()).not.toContain("No destinations found.");
      expect(rows(again)).toHaveLength(0);
    });
  });

  describe("US-6.2 — Add a destination", () => {
    it("Add destination opens the specified form", async () => {
      const wrapper = await openDestinations("admin");
      await wrapper.find('[data-testid="add-destination"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("destination-dialog")).toBe(true);
      expect(bodyText()).toContain("Add destination");
      expect(bodyText()).toContain("Name");
      expect(bodyText()).toContain("Address");
      expect(bodyText()).toContain("City");
      expect(bodyText()).toContain("State");
      expect(bodyText()).toContain("Zip");
      expect(bodyText()).toContain("Round-trip miles");
      expect(bodyText()).toContain("Status");
      expect(byTestId("save-destination").textContent).toContain("Save");
      expect(byTestId("cancel-destination").textContent).toContain("Cancel");
      expect(fieldValue("destination-name")).toBe("");
    });

    it("Saving a destination updates the list", async () => {
      const wrapper = await openDestinations("admin");
      await wrapper.find('[data-testid="add-destination"]').trigger("click");
      await flushPromises();
      await fillValidDestination();
      let resolveSave;
      DestinationServices.create.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
      const created = {
        id: 3,
        destinationName: "Norman Campus",
        addressLine: "1100 E 14th St",
        city: "Norman",
        state: "OK",
        zipCode: "73019",
        roundTripMiles: 45.5,
        status: "active",
      };
      DestinationServices.getAll.mockResolvedValue({ data: [...roster, created] });
      await click("save-destination");
      await click("save-destination");
      expect(DestinationServices.create).toHaveBeenCalledTimes(1);
      expect(DestinationServices.create).toHaveBeenCalledWith({
        destinationName: "Norman Campus",
        addressLine: "1100 E 14th St",
        city: "Norman",
        state: "OK",
        zipCode: "73019",
        roundTripMiles: 45.5,
        status: "active",
      });
      expect(byTestId("save-destination").disabled).toBe(true);

      resolveSave({ data: created });
      await flushPromises();
      expect(dialogOpen("destination-dialog")).toBe(false);
      expect(DestinationServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(3);
    });

    it("Cancel leaves destination records unchanged", async () => {
      const wrapper = await openDestinations("admin");
      await wrapper.find('[data-testid="add-destination"]').trigger("click");
      await flushPromises();
      await fill("destination-name", "Draft");
      await click("save-destination");
      expect(bodyText()).toContain("Invalid destination data.");
      await click("cancel-destination");
      expect(DestinationServices.create).not.toHaveBeenCalled();
      expect(dialogOpen("destination-dialog")).toBe(false);

      await wrapper.find('[data-testid="add-destination"]').trigger("click");
      await flushPromises();
      expect(fieldValue("destination-name")).toBe("");
      expect(bodyText()).not.toContain("Invalid destination data.");
      await click("cancel-destination");

      await rows(wrapper)[0].find('[data-testid="edit-destination"]').trigger("click");
      await flushPromises();
      await fill("destination-name", "Changed");
      await click("cancel-destination");
      expect(DestinationServices.update).not.toHaveBeenCalled();
      await rows(wrapper)[0].find('[data-testid="edit-destination"]').trigger("click");
      await flushPromises();
      expect(fieldValue("destination-name")).toBe("Oklahoma City Airport");
      expect(fieldValue("destination-city")).toBe("Oklahoma City");
    });

    it("Destination form rejects invalid fields before submitting", async () => {
      const wrapper = await openDestinations("admin");
      await wrapper.find('[data-testid="add-destination"]').trigger("click");
      await flushPromises();
      await click("save-destination");
      expect(bodyText()).toContain("Invalid destination data.");
      expect(dialogOpen("destination-dialog")).toBe(true);
      expect(DestinationServices.create).not.toHaveBeenCalled();
    });

    it("Failed destination save keeps the dialog open", async () => {
      const wrapper = await openDestinations("admin");
      await wrapper.find('[data-testid="add-destination"]').trigger("click");
      await flushPromises();
      await fillValidDestination();
      DestinationServices.create.mockRejectedValueOnce(apiError(500, "Destination request failed."));
      await click("save-destination");
      expect(dialogOpen("destination-dialog")).toBe(true);
      expect(bodyText()).toContain("Destination request failed.");
      expect(fieldValue("destination-name")).toBe("Norman Campus");

      DestinationServices.create.mockRejectedValueOnce(new Error("Network Error"));
      await click("save-destination");
      expect(dialogOpen("destination-dialog")).toBe(true);
      expect(bodyText()).toContain("Destination could not be saved.");
      expect(rows(wrapper)).toHaveLength(2);
    });
  });

  describe("US-6.3 — Edit a destination", () => {
    it("Edit destination opens with the current values", async () => {
      const wrapper = await openDestinations("admin");
      await rows(wrapper)[0].find('[data-testid="edit-destination"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("destination-dialog")).toBe(true);
      expect(bodyText()).toContain("Edit destination");
      expect(fieldValue("destination-name")).toBe("Oklahoma City Airport");
      expect(fieldValue("destination-address")).toBe("7100 Terminal Drive");
      expect(fieldValue("destination-city")).toBe("Oklahoma City");
      expect(fieldValue("destination-zip")).toBe("73159");
      expect(fieldValue("destination-miles")).toBe("120.5");
      expect(byTestId("save-destination").textContent).toContain("Save");
      expect(byTestId("cancel-destination").textContent).toContain("Cancel");
    });

    it("Saving an edited destination refreshes the list", async () => {
      const wrapper = await openDestinations("admin");
      await rows(wrapper)[0].find('[data-testid="edit-destination"]').trigger("click");
      await flushPromises();
      await fill("destination-city", "Midwest City");
      DestinationServices.update.mockResolvedValue({ data: { ...oklahoma, city: "Midwest City" } });
      DestinationServices.getAll.mockResolvedValue({ data: [{ ...oklahoma, city: "Midwest City" }, tulsa] });
      await click("save-destination");
      expect(DestinationServices.update).toHaveBeenCalledWith(1, expect.objectContaining({
        destinationName: "Oklahoma City Airport",
        city: "Midwest City",
        state: "OK",
        status: "active",
      }));
      expect(dialogOpen("destination-dialog")).toBe(false);
      expect(DestinationServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)[0].text()).toContain("Midwest City");
    });
  });

  describe("US-6.4 — Delete a destination", () => {
    it("Delete destination requires confirmation", async () => {
      const wrapper = await openDestinations("admin");
      await rows(wrapper)[0].find('[data-testid="delete-destination"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("delete-destination-dialog")).toBe(true);
      expect(bodyText()).toContain("Delete destination");
      expect(bodyText()).toContain("Delete this destination?");
      expect(byTestId("confirm-delete-destination").textContent).toContain("Delete");
      expect(byTestId("cancel-delete-destination").textContent).toContain("Cancel");
    });

    it("Confirmed destination deletion refreshes the list", async () => {
      const wrapper = await openDestinations("admin");
      await rows(wrapper)[0].find('[data-testid="delete-destination"]').trigger("click");
      await flushPromises();
      let resolveDelete;
      DestinationServices.remove.mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }));
      DestinationServices.getAll.mockResolvedValue({ data: [tulsa] });
      await click("confirm-delete-destination");
      await click("confirm-delete-destination");
      expect(DestinationServices.remove).toHaveBeenCalledTimes(1);
      expect(DestinationServices.remove).toHaveBeenCalledWith(1);
      expect(byTestId("confirm-delete-destination").disabled).toBe(true);

      resolveDelete({ data: { message: "Destination deleted." } });
      await flushPromises();
      expect(dialogOpen("delete-destination-dialog")).toBe(false);
      expect(DestinationServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(1);
      expect(rows(wrapper)[0].text()).toContain("Tulsa Downtown");
    });

    it("Failed destination deletion preserves the dialog and row", async () => {
      const wrapper = await openDestinations("admin");
      await rows(wrapper)[0].find('[data-testid="delete-destination"]').trigger("click");
      await flushPromises();
      DestinationServices.remove.mockRejectedValueOnce(apiError(500, "Destination request failed."));
      await click("confirm-delete-destination");
      expect(dialogOpen("delete-destination-dialog")).toBe(true);
      expect(bodyText()).toContain("Destination request failed.");
      expect(rows(wrapper)).toHaveLength(2);

      DestinationServices.remove.mockRejectedValueOnce(new Error("Network Error"));
      await click("confirm-delete-destination");
      expect(dialogOpen("delete-destination-dialog")).toBe(true);
      expect(bodyText()).toContain("Destination could not be deleted.");
      expect(rows(wrapper)).toHaveLength(2);
    });

    it("Cancel closes destination delete without a request", async () => {
      const wrapper = await openDestinations("admin");
      await rows(wrapper)[0].find('[data-testid="delete-destination"]').trigger("click");
      await flushPromises();
      await click("cancel-delete-destination");
      expect(DestinationServices.remove).not.toHaveBeenCalled();
      expect(dialogOpen("delete-destination-dialog")).toBe(false);
      expect(rows(wrapper)).toHaveLength(2);
    });
  });
});
