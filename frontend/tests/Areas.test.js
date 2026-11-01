/**
 * Feature 2 — Area Management
 * Spec: features/feature-2-area-management.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import AreaServices from "../src/services/areaServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/areaServices.js", () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const athletics = { id: 1, areaName: "Athletics", areaLogo: "https://example.org/logo.png", noticeEmail: "Collect keys from Athletics.\nReturn the vehicle clean." };
const maintenance = { id: 2, areaName: "Maintenance", areaLogo: "https://example.org/maintenance.png", noticeEmail: "Pick up at the shop." };
const areas = [athletics, maintenance];
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

// Signs in with the given role and opens /areas with the mocked list.
async function openAreas(role, areaId = null, list = areas) {
  Utils.setStore("user", { ...account(role, areaId), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role, areaId) });
  AreaServices.getAll.mockResolvedValue({ data: list });
  return mountApp("/areas");
}

// Dialogs render in Vuetify's overlay container on document.body, outside the wrapper.
const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
// Vuetify keeps a closed dialog in the DOM; open means its overlay is active.
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
const fieldValue = (id) => document.querySelector(`[data-testid="${id}"] input, [data-testid="${id}"] textarea`)?.value;
const rows = (wrapper) => wrapper.findAll('[data-testid="area-row"]');

beforeEach(async () => {
  localStorage.clear();
  vi.resetAllMocks();
  await router.push("/login");
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.querySelectorAll(".v-overlay-container").forEach((node) => node.remove());
});

describe("Feature 2 — Area Management", () => {
  describe("US-2.1 — View areas", () => {
    it("Areas page shows all records and permitted actions", async () => {
      // Admin reaches Areas through MenuBar and sees every write action.
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      AreaServices.getAll.mockResolvedValue({ data: areas });
      let wrapper = await mountApp("/");
      await wrapper.find('[data-testid="nav-areas"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("areas");
      expect(wrapper.find("h1").text()).toBe("Areas");
      expect(rows(wrapper)).toHaveLength(2);
      expect(rows(wrapper)[0].text()).toContain("Athletics");
      const logo = rows(wrapper)[0].find("img");
      expect(logo.attributes("src")).toBe(athletics.areaLogo);
      expect(logo.attributes("alt")).toBe("Athletics");
      const notice = rows(wrapper)[0].find('[data-testid="area-notice-text"]');
      expect(notice.text()).toContain("Collect keys from Athletics.");
      expect(notice.text()).toContain("Return the vehicle clean.");
      expect(notice.element.textContent).toContain("\n");
      expect(wrapper.find('[data-testid="add-area"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="edit-area"]')).toHaveLength(2);
      expect(wrapper.findAll('[data-testid="delete-area"]')).toHaveLength(2);
      wrapper.unmount();
      mounted.pop();

      // An area admin sees every row but may only edit its own.
      wrapper = await openAreas("area_admin", 2);
      expect(rows(wrapper)).toHaveLength(2);
      expect(wrapper.find('[data-testid="add-area"]').exists()).toBe(false);
      expect(wrapper.findAll('[data-testid="delete-area"]')).toHaveLength(0);
      expect(rows(wrapper)[0].find('[data-testid="edit-area"]').exists()).toBe(false);
      expect(rows(wrapper)[1].find('[data-testid="edit-area"]').exists()).toBe(true);
      wrapper.unmount();
      mounted.pop();

      // Requestors and maintenance users read only.
      for (const role of ["requestor", "maintenance"]) {
        wrapper = await openAreas(role);
        expect(rows(wrapper)).toHaveLength(2);
        expect(wrapper.find('[data-testid="add-area"]').exists()).toBe(false);
        expect(wrapper.findAll('[data-testid="edit-area"]')).toHaveLength(0);
        expect(wrapper.findAll('[data-testid="delete-area"]')).toHaveLength(0);
        wrapper.unmount();
        mounted.pop();
      }
    });

    it("Areas navigation requires sign-in", async () => {
      const wrapper = await mountApp("/areas");
      expect(router.currentRoute.value.name).toBe("login");
      expect(AreaServices.getAll).not.toHaveBeenCalled();
      expect(wrapper.findAll('[data-testid="area-row"]')).toHaveLength(0);
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Areas page distinguishes loading empty and failed states", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      let resolveList;
      AreaServices.getAll.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
      const wrapper = await mountApp("/areas");
      expect(wrapper.find('[data-testid="areas-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("No areas found.");

      resolveList({ data: [] });
      await flushPromises();
      expect(wrapper.find('[data-testid="areas-loading"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("No areas found.");
      expect(rows(wrapper)).toHaveLength(0);
    });

    it("Area list failure does not show an empty list", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      AreaServices.getAll.mockRejectedValueOnce(apiError(500, "Area request failed."));
      const wrapper = await mountApp("/areas");
      expect(wrapper.text()).toContain("Area request failed.");
      expect(wrapper.text()).not.toContain("No areas found.");
      wrapper.unmount();
      mounted.pop();

      AreaServices.getAll.mockRejectedValueOnce(new Error("Network Error"));
      const again = await mountApp("/areas");
      expect(again.text()).toContain("Areas could not be loaded.");
      expect(again.text()).not.toContain("No areas found.");
      expect(rows(again)).toHaveLength(0);
    });
  });

  describe("US-2.2 — Create an area", () => {
    it("Add area opens the specified form", async () => {
      const wrapper = await openAreas("admin");
      await wrapper.find('[data-testid="add-area"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("area-dialog")).toBe(true);
      expect(bodyText()).toContain("Add area");
      expect(bodyText()).toContain("Area name");
      expect(bodyText()).toContain("Logo URL");
      expect(bodyText()).toContain("Notice email");
      const notice = document.querySelector('[data-testid="area-notice"] textarea');
      expect(notice).not.toBeNull();
      expect(notice.getAttribute("maxlength")).toBe("5000");
      expect(bodyText()).toContain("Your area's day-before-trip instructions. Trip details are added automatically.");
      expect(byTestId("save-area").textContent).toContain("Save");
      expect(byTestId("cancel-area").textContent).toContain("Cancel");
      expect(fieldValue("area-name")).toBe("");
    });

    it("Saving an area updates the list", async () => {
      const wrapper = await openAreas("admin");
      await wrapper.find('[data-testid="add-area"]').trigger("click");
      await flushPromises();
      await fill("area-name", "Campus Events");
      await fill("area-logo", "https://example.org/events.png");
      await fill("area-notice", "Keys at the events office.");
      let resolveSave;
      AreaServices.create.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
      AreaServices.getAll.mockResolvedValue({ data: [...areas, { id: 3, areaName: "Campus Events", areaLogo: "https://example.org/events.png", noticeEmail: "Keys at the events office." }] });
      await click("save-area");
      await click("save-area");
      expect(AreaServices.create).toHaveBeenCalledTimes(1);
      expect(AreaServices.create).toHaveBeenCalledWith({ areaName: "Campus Events", areaLogo: "https://example.org/events.png", noticeEmail: "Keys at the events office." });
      expect(byTestId("save-area").disabled).toBe(true);
      expect(byTestId("area-dialog").querySelector(".v-progress-circular, .v-btn--loading")).not.toBeNull();

      resolveSave({ data: { id: 3, areaName: "Campus Events", areaLogo: "https://example.org/events.png", noticeEmail: "Keys at the events office." } });
      await flushPromises();
      expect(dialogOpen("area-dialog")).toBe(false);
      expect(AreaServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(3);
    });

    it("Cancel leaves area records unchanged", async () => {
      const wrapper = await openAreas("admin");
      await wrapper.find('[data-testid="add-area"]').trigger("click");
      await flushPromises();
      await fill("area-name", "Draft");
      await click("save-area");
      expect(bodyText()).toContain("Invalid area data.");
      await click("cancel-area");
      expect(AreaServices.create).not.toHaveBeenCalled();
      expect(dialogOpen("area-dialog")).toBe(false);

      await wrapper.find('[data-testid="add-area"]').trigger("click");
      await flushPromises();
      expect(fieldValue("area-name")).toBe("");
      expect(bodyText()).not.toContain("Invalid area data.");
      await click("cancel-area");

      await rows(wrapper)[0].find('[data-testid="edit-area"]').trigger("click");
      await flushPromises();
      await fill("area-name", "Changed");
      await click("cancel-area");
      expect(AreaServices.update).not.toHaveBeenCalled();
      await rows(wrapper)[0].find('[data-testid="edit-area"]').trigger("click");
      await flushPromises();
      expect(fieldValue("area-name")).toBe("Athletics");
      expect(fieldValue("area-notice")).toBe(athletics.noticeEmail);
    });

    it("Area form rejects invalid fields before submitting", async () => {
      const wrapper = await openAreas("admin");
      await wrapper.find('[data-testid="add-area"]').trigger("click");
      await flushPromises();
      const valid = { "area-name": "Campus Events", "area-logo": "https://example.org/events.png", "area-notice": "Keys at the office." };
      const invalid = [
        ["area-name", ""], ["area-name", "   "], ["area-name", "a".repeat(101)],
        ["area-logo", ""], ["area-logo", "http://example.org/logo.png"], ["area-logo", "not a url"],
        ["area-notice", ""], ["area-notice", "   "], ["area-notice", "x".repeat(5001)],
      ];
      for (const [field, value] of invalid) {
        for (const [id, text] of Object.entries(valid)) await fill(id, text);
        await fill(field, value);
        await click("save-area");
        expect(bodyText()).toContain("Invalid area data.");
        expect(dialogOpen("area-dialog")).toBe(true);
      }
      expect(AreaServices.create).not.toHaveBeenCalled();
    });

    it("Failed area save retains entered values", async () => {
      const wrapper = await openAreas("admin");
      await wrapper.find('[data-testid="add-area"]').trigger("click");
      await flushPromises();
      await fill("area-name", "Athletics");
      await fill("area-logo", "https://example.org/logo.png");
      await fill("area-notice", "Collect keys.");
      AreaServices.create.mockRejectedValueOnce(apiError(409, "Area name is already in use."));
      await click("save-area");
      expect(dialogOpen("area-dialog")).toBe(true);
      expect(bodyText()).toContain("Area name is already in use.");
      expect(fieldValue("area-name")).toBe("Athletics");
      expect(fieldValue("area-notice")).toBe("Collect keys.");

      AreaServices.create.mockRejectedValueOnce(new Error("Network Error"));
      await click("save-area");
      expect(dialogOpen("area-dialog")).toBe(true);
      expect(bodyText()).toContain("Area could not be saved.");
      expect(fieldValue("area-logo")).toBe("https://example.org/logo.png");

      AreaServices.update.mockRejectedValueOnce(apiError(500, "Area request failed."));
      await click("cancel-area");
      await rows(wrapper)[1].find('[data-testid="edit-area"]').trigger("click");
      await flushPromises();
      await fill("area-notice", "New instructions.");
      await click("save-area");
      expect(dialogOpen("area-dialog")).toBe(true);
      expect(bodyText()).toContain("Area request failed.");
      expect(fieldValue("area-notice")).toBe("New instructions.");
    });
  });

  describe("US-2.3 — Update an area", () => {
    it("Edit area shows current data and refreshes after saving", async () => {
      const wrapper = await openAreas("area_admin", 2);
      await rows(wrapper)[1].find('[data-testid="edit-area"]').trigger("click");
      await flushPromises();
      expect(bodyText()).toContain("Edit area");
      expect(fieldValue("area-name")).toBe("Maintenance");
      expect(fieldValue("area-logo")).toBe(maintenance.areaLogo);
      expect(fieldValue("area-notice")).toBe(maintenance.noticeEmail);

      await fill("area-notice", "Keys are at the shop window.");
      AreaServices.update.mockResolvedValue({ data: { ...maintenance, noticeEmail: "Keys are at the shop window." } });
      AreaServices.getAll.mockResolvedValue({ data: [athletics, { ...maintenance, noticeEmail: "Keys are at the shop window." }] });
      await click("save-area");
      expect(AreaServices.update).toHaveBeenCalledWith(2, { areaName: "Maintenance", areaLogo: maintenance.areaLogo, noticeEmail: "Keys are at the shop window." });
      expect(dialogOpen("area-dialog")).toBe(false);
      expect(AreaServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)[1].text()).toContain("Keys are at the shop window.");
    });
  });

  describe("US-2.4 — Delete an unused area", () => {
    it("Delete area requires confirmation", async () => {
      const wrapper = await openAreas("admin");
      await rows(wrapper)[0].find('[data-testid="delete-area"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("delete-dialog")).toBe(true);
      expect(bodyText()).toContain("Delete area");
      expect(bodyText()).toContain("Delete this area?");
      expect(byTestId("confirm-delete").textContent).toContain("Delete");
      expect(byTestId("cancel-delete").textContent).toContain("Cancel");
      await click("cancel-delete");
      expect(AreaServices.remove).not.toHaveBeenCalled();
      expect(dialogOpen("delete-dialog")).toBe(false);
      expect(rows(wrapper)).toHaveLength(2);
    });

    it("Confirmed deletion refreshes the list", async () => {
      const wrapper = await openAreas("admin");
      await rows(wrapper)[0].find('[data-testid="delete-area"]').trigger("click");
      await flushPromises();
      let resolveDelete;
      AreaServices.remove.mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }));
      AreaServices.getAll.mockResolvedValue({ data: [maintenance] });
      await click("confirm-delete");
      await click("confirm-delete");
      expect(AreaServices.remove).toHaveBeenCalledTimes(1);
      expect(AreaServices.remove).toHaveBeenCalledWith(1);
      expect(byTestId("confirm-delete").disabled).toBe(true);

      resolveDelete({ data: { message: "Area deleted." } });
      await flushPromises();
      expect(dialogOpen("delete-dialog")).toBe(false);
      expect(AreaServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(1);
      expect(rows(wrapper)[0].text()).toContain("Maintenance");
    });

    it("Failed area deletion preserves the dialog and row", async () => {
      const wrapper = await openAreas("admin");
      await rows(wrapper)[0].find('[data-testid="delete-area"]').trigger("click");
      await flushPromises();
      AreaServices.remove.mockRejectedValueOnce(apiError(409, "Area is in use."));
      await click("confirm-delete");
      expect(dialogOpen("delete-dialog")).toBe(true);
      expect(bodyText()).toContain("Area is in use.");
      expect(rows(wrapper)).toHaveLength(2);

      AreaServices.remove.mockRejectedValueOnce(new Error("Network Error"));
      await click("confirm-delete");
      expect(dialogOpen("delete-dialog")).toBe(true);
      expect(bodyText()).toContain("Area could not be deleted.");
      expect(rows(wrapper)).toHaveLength(2);
      expect(AreaServices.getAll).toHaveBeenCalledTimes(1);
    });
  });
});
