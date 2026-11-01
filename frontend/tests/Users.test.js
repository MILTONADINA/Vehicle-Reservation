/**
 * Feature 3 — User Management
 * Spec: features/feature-3-user-management.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import AreaServices from "../src/services/areaServices.js";
import UserServices from "../src/services/userServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/areaServices.js", () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("../src/services/userServices.js", () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const areas = [
  { id: 1, areaName: "Athletics", areaLogo: "https://example.org/a.png", noticeEmail: "Keys at Athletics." },
  { id: 2, areaName: "Maintenance", areaLogo: "https://example.org/m.png", noticeEmail: "Keys at the shop." },
];
const adminUser = { id: 10, email: "admin@oc.edu", firstName: "Dana", lastName: "Admin", role: "admin", areaId: null };
const areaAdminUser = { id: 11, email: "one@oc.edu", firstName: "Ari", lastName: "One", role: "area_admin", areaId: 1 };
const requestorUser = { id: 12, email: "req@oc.edu", firstName: "Casey", lastName: "Req", role: "requestor", areaId: null };
const maintenanceUser = { id: 13, email: "fix@oc.edu", firstName: "Drew", lastName: "Fix", role: "maintenance", areaId: null };
const users = [adminUser, maintenanceUser, areaAdminUser, requestorUser];
const account = (user) => ({ userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, areaId: user.areaId });
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
async function openUsers(asUser, list = users, areaList = areas) {
  Utils.setStore("user", { ...account(asUser), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(asUser) });
  UserServices.getAll.mockResolvedValue({ data: list });
  AreaServices.getAll.mockResolvedValue({ data: areaList });
  return mountApp("/users");
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
const fieldValue = (id) => document.querySelector(`[data-testid="${id}"] input`)?.value;
const select = (wrapper, id) => wrapper.findComponent(`[data-testid="${id}"]`);
async function choose(wrapper, id, value) {
  await select(wrapper, id).setValue(value);
  await flushPromises();
}
const rows = (wrapper) => wrapper.findAll('[data-testid="user-row"]');
const rowFor = (wrapper, email) => rows(wrapper).find((row) => row.text().includes(email));

beforeEach(async () => {
  localStorage.clear();
  vi.resetAllMocks();
  await router.push("/login");
});
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.querySelectorAll(".v-overlay-container").forEach((node) => node.remove());
});

describe("Feature 3 — User Management", () => {
  describe("US-3.1 — View users", () => {
    it("Users page shows all records and permitted actions", async () => {
      let wrapper = await openUsers(adminUser);
      expect(wrapper.find("h1").text()).toBe("Users");
      const headers = wrapper.findAll("th").map((th) => th.text());
      expect(headers).toEqual(["Email", "First name", "Last name", "Role", "Area", "Actions"]);
      expect(rows(wrapper)).toHaveLength(4);
      expect(rowFor(wrapper, "one@oc.edu").text()).toContain("Athletics");
      expect(rowFor(wrapper, "req@oc.edu").text()).toContain("Unassigned");
      expect(wrapper.find('[data-testid="add-user"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="edit-user"]')).toHaveLength(4);
      expect(wrapper.findAll('[data-testid="delete-user"]')).toHaveLength(3);
      expect(rowFor(wrapper, "admin@oc.edu").find('[data-testid="delete-user"]').exists()).toBe(false);
      wrapper.unmount();
      mounted.pop();

      wrapper = await openUsers(areaAdminUser);
      expect(rows(wrapper)).toHaveLength(4);
      expect(wrapper.find('[data-testid="add-user"]').exists()).toBe(false);
      for (const email of ["admin@oc.edu", "one@oc.edu"]) {
        expect(rowFor(wrapper, email).find('[data-testid="edit-user"]').exists()).toBe(false);
        expect(rowFor(wrapper, email).find('[data-testid="delete-user"]').exists()).toBe(false);
      }
      for (const email of ["req@oc.edu", "fix@oc.edu"]) {
        expect(rowFor(wrapper, email).find('[data-testid="edit-user"]').exists()).toBe(true);
        expect(rowFor(wrapper, email).find('[data-testid="delete-user"]').exists()).toBe(true);
      }
    });

    it("User management navigation respects role boundaries", async () => {
      let wrapper = await mountApp("/users");
      expect(router.currentRoute.value.name).toBe("login");
      expect(UserServices.getAll).not.toHaveBeenCalled();
      wrapper.unmount();
      mounted.pop();

      for (const user of [requestorUser, maintenanceUser]) {
        Utils.setStore("user", { ...account(user), token: "session-token" });
        AuthServices.me.mockResolvedValue({ data: account(user) });
        wrapper = await mountApp("/users");
        expect(router.currentRoute.value.name).toBe("home");
        expect(wrapper.find('[data-testid="nav-users"]').exists()).toBe(false);
        expect(UserServices.getAll).not.toHaveBeenCalled();
        wrapper.unmount();
        mounted.pop();
      }

      Utils.setStore("user", { ...account(adminUser), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account(adminUser) });
      UserServices.getAll.mockResolvedValue({ data: users });
      AreaServices.getAll.mockResolvedValue({ data: areas });
      wrapper = await mountApp("/");
      expect(wrapper.find('[data-testid="nav-users"]').exists()).toBe(true);
      wrapper.unmount();
      mounted.pop();

      // The link also shows for an area admin and leads to the Users page.
      Utils.setStore("user", { ...account(areaAdminUser), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account(areaAdminUser) });
      wrapper = await mountApp("/");
      await wrapper.find('[data-testid="nav-users"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("users");
      expect(rows(wrapper)).toHaveLength(4);
    });

    it("Users page distinguishes loading and empty results", async () => {
      Utils.setStore("user", { ...account(adminUser), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account(adminUser) });
      AreaServices.getAll.mockResolvedValue({ data: areas });
      let resolveList;
      UserServices.getAll.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
      const wrapper = await mountApp("/users");
      expect(wrapper.find('[data-testid="users-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("No users found.");
      resolveList({ data: [] });
      await flushPromises();
      expect(wrapper.find('[data-testid="users-loading"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("No users found.");
    });

    it("User list failure shows an error without an empty message", async () => {
      Utils.setStore("user", { ...account(adminUser), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account(adminUser) });
      AreaServices.getAll.mockResolvedValue({ data: areas });
      UserServices.getAll.mockRejectedValueOnce(apiError(500, "User request failed."));
      let wrapper = await mountApp("/users");
      expect(wrapper.text()).toContain("User request failed.");
      expect(wrapper.text()).not.toContain("No users found.");
      wrapper.unmount();
      mounted.pop();

      UserServices.getAll.mockRejectedValueOnce(new Error("Network Error"));
      wrapper = await mountApp("/users");
      expect(wrapper.text()).toContain("Users could not be loaded.");
      expect(wrapper.text()).not.toContain("No users found.");
    });

    it("Unavailable area options block user writes", async () => {
      Utils.setStore("user", { ...account(adminUser), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account(adminUser) });
      UserServices.getAll.mockResolvedValue({ data: users });
      AreaServices.getAll.mockRejectedValueOnce(apiError(500, "Area request failed."));
      let wrapper = await mountApp("/users");
      expect(rows(wrapper)).toHaveLength(4);
      expect(wrapper.text()).toContain("Area request failed.");
      expect(wrapper.text()).not.toContain("No users found.");
      // Without area names an assigned account must not be presented as unassigned.
      expect(rowFor(wrapper, "one@oc.edu").text()).toContain("Unavailable");
      expect(rowFor(wrapper, "req@oc.edu").text()).toContain("Unassigned");
      expect(wrapper.find('[data-testid="add-user"]').attributes("disabled")).toBeDefined();
      for (const button of wrapper.findAll('[data-testid="edit-user"]')) expect(button.attributes("disabled")).toBeDefined();
      wrapper.unmount();
      mounted.pop();

      AreaServices.getAll.mockRejectedValueOnce(new Error("Network Error"));
      wrapper = await mountApp("/users");
      expect(wrapper.text()).toContain("Area options could not be loaded.");
      expect(wrapper.find('[data-testid="add-user"]').attributes("disabled")).toBeDefined();
      wrapper.unmount();
      mounted.pop();

      AreaServices.getAll.mockResolvedValue({ data: areas });
      wrapper = await mountApp("/users");
      expect(wrapper.text()).not.toContain("Area options could not be loaded.");
      expect(wrapper.find('[data-testid="add-user"]').attributes("disabled")).toBeUndefined();
      wrapper.unmount();
      mounted.pop();

      // An area admin's Edit controls are blocked the same way.
      AreaServices.getAll.mockRejectedValueOnce(apiError(500, "Area request failed."));
      wrapper = await openUsers(areaAdminUser);
      expect(wrapper.text()).toContain("Area request failed.");
      expect(wrapper.findAll('[data-testid="edit-user"]')).toHaveLength(2);
      for (const button of wrapper.findAll('[data-testid="edit-user"]')) expect(button.attributes("disabled")).toBeDefined();
    });
  });

  describe("US-3.2 — Create an OC user account", () => {
    it("Add user form offers permitted roles and areas", async () => {
      const wrapper = await openUsers(adminUser);
      await wrapper.find('[data-testid="add-user"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("user-dialog")).toBe(true);
      expect(bodyText()).toContain("Add user");
      for (const label of ["Email", "First name", "Last name", "Role", "Area"]) expect(bodyText()).toContain(label);
      expect(select(wrapper, "user-role").props("items").map((item) => item.value ?? item)).toEqual(["admin", "area_admin", "requestor", "maintenance"]);
      expect(select(wrapper, "user-area").props("disabled")).toBe(true);
      await choose(wrapper, "user-role", "area_admin");
      expect(select(wrapper, "user-area").props("disabled")).toBe(false);
      expect(select(wrapper, "user-area").props("items").map((item) => item.title ?? item.areaName)).toEqual(["Athletics", "Maintenance"]);
      await choose(wrapper, "user-role", "requestor");
      expect(select(wrapper, "user-area").props("disabled")).toBe(true);
      expect(byTestId("save-user").textContent).toContain("Save");
      expect(byTestId("cancel-user").textContent).toContain("Cancel");
    });

    it("Create user success refreshes the list", async () => {
      const wrapper = await openUsers(adminUser);
      await wrapper.find('[data-testid="add-user"]').trigger("click");
      await flushPromises();
      await fill("user-email", "new.person@oc.edu");
      await fill("user-first", "New");
      await fill("user-last", "Person");
      await choose(wrapper, "user-role", "requestor");
      let resolveSave;
      UserServices.create.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
      UserServices.getAll.mockResolvedValue({ data: [...users, { id: 14, email: "new.person@oc.edu", firstName: "New", lastName: "Person", role: "requestor", areaId: null }] });
      await click("save-user");
      await click("save-user");
      expect(UserServices.create).toHaveBeenCalledTimes(1);
      expect(UserServices.create).toHaveBeenCalledWith({ email: "new.person@oc.edu", firstName: "New", lastName: "Person", role: "requestor", areaId: null });
      expect(byTestId("save-user").disabled).toBe(true);
      resolveSave({ data: { id: 14, email: "new.person@oc.edu", firstName: "New", lastName: "Person", role: "requestor", areaId: null } });
      await flushPromises();
      expect(dialogOpen("user-dialog")).toBe(false);
      expect(UserServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(5);
    });

    it("Invalid user form does not submit", async () => {
      const wrapper = await openUsers(adminUser);
      const attempts = [
        { firstName: "   " },
        { lastName: "" },
        { firstName: "a".repeat(101) },
        { email: "new.person@gmail.com" },
        { email: "not an email" },
        { role: null },
        { role: "area_admin" },
      ];
      // Each attempt starts from a fresh dialog so the error it shows is its own.
      for (const spoil of attempts) {
        await wrapper.find('[data-testid="add-user"]').trigger("click");
        await flushPromises();
        expect(byTestId("user-form-error")).toBeNull();
        const form = { email: "new.person@oc.edu", firstName: "New", lastName: "Person", role: "requestor", ...spoil };
        await fill("user-email", form.email);
        await fill("user-first", form.firstName);
        await fill("user-last", form.lastName);
        if (form.role) await choose(wrapper, "user-role", form.role);
        await click("save-user");
        expect(byTestId("user-form-error")?.textContent).toContain("Invalid user data.");
        expect(dialogOpen("user-dialog")).toBe(true);
        await click("cancel-user");
      }
      expect(UserServices.create).not.toHaveBeenCalled();
    });

    it("Cancel user form discards changes and errors", async () => {
      const wrapper = await openUsers(adminUser);
      await wrapper.find('[data-testid="add-user"]').trigger("click");
      await flushPromises();
      await fill("user-first", "Draft");
      await click("save-user");
      expect(bodyText()).toContain("Invalid user data.");
      await click("cancel-user");
      expect(UserServices.create).not.toHaveBeenCalled();
      expect(dialogOpen("user-dialog")).toBe(false);
      await wrapper.find('[data-testid="add-user"]').trigger("click");
      await flushPromises();
      expect(fieldValue("user-first")).toBe("");
      expect(bodyText()).not.toContain("Invalid user data.");
      await click("cancel-user");

      await rowFor(wrapper, "req@oc.edu").find('[data-testid="edit-user"]').trigger("click");
      await flushPromises();
      await fill("user-first", "Changed");
      await click("cancel-user");
      expect(UserServices.update).not.toHaveBeenCalled();
      await rowFor(wrapper, "req@oc.edu").find('[data-testid="edit-user"]').trigger("click");
      await flushPromises();
      expect(fieldValue("user-first")).toBe("Casey");
    });

    it("User save failure preserves form data", async () => {
      const wrapper = await openUsers(adminUser);
      await wrapper.find('[data-testid="add-user"]').trigger("click");
      await flushPromises();
      await fill("user-email", "req@oc.edu");
      await fill("user-first", "Casey");
      await fill("user-last", "Req");
      await choose(wrapper, "user-role", "requestor");
      UserServices.create.mockRejectedValueOnce(apiError(409, "Email is already in use."));
      await click("save-user");
      expect(dialogOpen("user-dialog")).toBe(true);
      expect(bodyText()).toContain("Email is already in use.");
      expect(fieldValue("user-email")).toBe("req@oc.edu");
      expect(fieldValue("user-first")).toBe("Casey");
      UserServices.create.mockRejectedValueOnce(new Error("Network Error"));
      await click("save-user");
      expect(bodyText()).toContain("User could not be saved.");
      expect(fieldValue("user-last")).toBe("Req");
      await click("cancel-user");

      await rowFor(wrapper, "fix@oc.edu").find('[data-testid="edit-user"]').trigger("click");
      await flushPromises();
      await fill("user-last", "Fixer");
      UserServices.update.mockRejectedValueOnce(apiError(500, "User request failed."));
      await click("save-user");
      expect(dialogOpen("user-dialog")).toBe(true);
      expect(bodyText()).toContain("User request failed.");
      expect(fieldValue("user-last")).toBe("Fixer");
    });
  });

  describe("US-3.3 — Update user details and access", () => {
    it("Edit user form preserves immutable identity", async () => {
      let wrapper = await openUsers(adminUser);
      await rowFor(wrapper, "one@oc.edu").find('[data-testid="edit-user"]').trigger("click");
      await flushPromises();
      expect(bodyText()).toContain("Edit user");
      const email = document.querySelector('[data-testid="user-email"] input');
      expect(email.value).toBe("one@oc.edu");
      expect(email.hasAttribute("readonly") || email.hasAttribute("disabled")).toBe(true);
      expect(fieldValue("user-first")).toBe("Ari");
      expect(fieldValue("user-last")).toBe("One");
      expect(select(wrapper, "user-role").props("modelValue")).toBe("area_admin");
      expect(select(wrapper, "user-area").props("modelValue")).toBe(1);
      expect(select(wrapper, "user-area").props("disabled")).toBe(false);
      await click("cancel-user");

      // The admin's own role is locked.
      await rowFor(wrapper, "admin@oc.edu").find('[data-testid="edit-user"]').trigger("click");
      await flushPromises();
      expect(select(wrapper, "user-role").props("disabled")).toBe(true);
      await click("cancel-user");
      wrapper.unmount();
      mounted.pop();

      // An area admin may only choose ordinary roles and sees Area read-only as Unassigned.
      wrapper = await openUsers(areaAdminUser);
      await rowFor(wrapper, "req@oc.edu").find('[data-testid="edit-user"]').trigger("click");
      await flushPromises();
      expect(select(wrapper, "user-role").props("items").map((item) => item.value ?? item)).toEqual(["requestor", "maintenance"]);
      expect(select(wrapper, "user-area").props("disabled")).toBe(true);
      expect(select(wrapper, "user-area").props("items")).toEqual([{ title: "Unassigned", value: null }]);
      expect(select(wrapper, "user-area").props("modelValue")).toBeNull();
    });

    it("User update refreshes the list", async () => {
      const wrapper = await openUsers(adminUser);
      await rowFor(wrapper, "req@oc.edu").find('[data-testid="edit-user"]').trigger("click");
      await flushPromises();
      await fill("user-last", "Renamed");
      await choose(wrapper, "user-role", "maintenance");
      UserServices.update.mockResolvedValue({ data: { ...requestorUser, lastName: "Renamed", role: "maintenance" } });
      UserServices.getAll.mockResolvedValue({ data: [adminUser, maintenanceUser, areaAdminUser, { ...requestorUser, lastName: "Renamed", role: "maintenance" }] });
      await click("save-user");
      expect(UserServices.update).toHaveBeenCalledWith(12, { firstName: "Casey", lastName: "Renamed", role: "maintenance", areaId: null });
      expect(dialogOpen("user-dialog")).toBe(false);
      expect(UserServices.getAll).toHaveBeenCalledTimes(2);
      expect(rowFor(wrapper, "req@oc.edu").text()).toContain("Renamed");
      expect(rowFor(wrapper, "req@oc.edu").text()).toContain("maintenance");
    });
  });

  describe("US-3.4 — Delete a user account", () => {
    it("User deletion requires confirmation", async () => {
      const wrapper = await openUsers(adminUser);
      await rowFor(wrapper, "req@oc.edu").find('[data-testid="delete-user"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("delete-user-dialog")).toBe(true);
      expect(bodyText()).toContain("Delete user");
      expect(bodyText()).toContain("Delete this user?");
      await click("cancel-delete-user");
      expect(UserServices.remove).not.toHaveBeenCalled();
      expect(dialogOpen("delete-user-dialog")).toBe(false);
    });

    it("Successful user deletion refreshes the list", async () => {
      const wrapper = await openUsers(adminUser);
      await rowFor(wrapper, "req@oc.edu").find('[data-testid="delete-user"]').trigger("click");
      await flushPromises();
      let resolveDelete;
      UserServices.remove.mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }));
      UserServices.getAll.mockResolvedValue({ data: users.filter((user) => user.id !== 12) });
      await click("confirm-delete-user");
      await click("confirm-delete-user");
      expect(UserServices.remove).toHaveBeenCalledTimes(1);
      expect(UserServices.remove).toHaveBeenCalledWith(12);
      expect(byTestId("confirm-delete-user").disabled).toBe(true);
      resolveDelete({ data: { message: "User deleted." } });
      await flushPromises();
      expect(dialogOpen("delete-user-dialog")).toBe(false);
      expect(UserServices.getAll).toHaveBeenCalledTimes(2);
      expect(rowFor(wrapper, "req@oc.edu")).toBeUndefined();
    });

    it("Failed user deletion preserves the account", async () => {
      const wrapper = await openUsers(adminUser);
      await rowFor(wrapper, "req@oc.edu").find('[data-testid="delete-user"]').trigger("click");
      await flushPromises();
      UserServices.remove.mockRejectedValueOnce(apiError(500, "User request failed."));
      await click("confirm-delete-user");
      expect(dialogOpen("delete-user-dialog")).toBe(true);
      expect(bodyText()).toContain("User request failed.");
      expect(rowFor(wrapper, "req@oc.edu")).toBeDefined();
      UserServices.remove.mockRejectedValueOnce(new Error("Network Error"));
      await click("confirm-delete-user");
      expect(bodyText()).toContain("User could not be deleted.");
      expect(rowFor(wrapper, "req@oc.edu")).toBeDefined();
      expect(UserServices.getAll).toHaveBeenCalledTimes(1);
    });
  });
});
