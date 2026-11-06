/**
 * Feature 10 — Vehicle Issue Reports (open Issues page)
 * Spec: features/feature-10-vehicle-issue-reports.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import IssueServices from "../src/services/issueServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/issueServices.js", () => ({
  default: { listOpen: vi.fn(), listForRequest: vi.fn(), createForRequest: vi.fn() },
}));

const issueLowGas = {
  id: 1,
  requestId: 10,
  vehicleId: 3,
  issueType: "low_gas",
  timing: "after",
  note: "Near empty",
  reportedByUserId: 8,
  createdAt: "2026-10-27T18:00:00.000Z",
};
const issueMaintenance = {
  id: 2,
  requestId: 11,
  vehicleId: null,
  issueType: "maintenance_need",
  timing: "before",
  note: null,
  reportedByUserId: 8,
  createdAt: "2026-10-27T19:00:00.000Z",
};
const issueList = [issueLowGas, issueMaintenance];

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

async function openIssues(role, areaId = null, list = issueList) {
  Utils.setStore("user", { ...account(role, areaId), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role, areaId) });
  IssueServices.listOpen.mockResolvedValue({ data: list });
  return mountApp("/issues");
}

const rows = (wrapper) => wrapper.findAll('[data-testid="issue-row"]');

beforeEach(async () => {
  localStorage.clear();
  vi.resetAllMocks();
  await router.push("/login");
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.querySelectorAll(".v-overlay-container").forEach((node) => node.remove());
});

describe("Feature 10 — Issues page", () => {
  describe("US-10.2 — View issue reports", () => {
    it("Issues page shows allowed rows", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      IssueServices.listOpen.mockResolvedValue({ data: issueList });
      let wrapper = await mountApp("/");
      await wrapper.find('[data-testid="nav-issues"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("issues");
      expect(wrapper.find("h1").text()).toBe("Issues");
      expect(rows(wrapper)).toHaveLength(2);
      expect(rows(wrapper)[0].text()).toContain("10");
      expect(rows(wrapper)[0].text()).toContain("Low gas");
      expect(rows(wrapper)[0].text()).toContain("After");
      expect(rows(wrapper)[0].text()).toContain("3");
      expect(rows(wrapper)[1].text()).toContain("11");
      expect(rows(wrapper)[1].text()).toContain("Maintenance need");
      expect(rows(wrapper)[1].text()).toContain("Before");
      wrapper.unmount();
      mounted.pop();

      for (const role of ["area_admin", "maintenance"]) {
        wrapper = await openIssues(role, role === "area_admin" ? 2 : null, [issueMaintenance]);
        expect(router.currentRoute.value.name).toBe("issues");
        expect(rows(wrapper)).toHaveLength(1);
        expect(rows(wrapper)[0].text()).toContain("Maintenance need");
        expect(wrapper.find('[data-testid="nav-issues"]').exists()).toBe(true);
        wrapper.unmount();
        mounted.pop();
      }
    });

    it("Requestor is sent Home from Issues", async () => {
      Utils.setStore("user", { ...account("requestor"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("requestor") });
      const wrapper = await mountApp("/");
      expect(wrapper.find('[data-testid="nav-issues"]').exists()).toBe(false);
      await router.push("/issues");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("home");
      expect(IssueServices.listOpen).not.toHaveBeenCalled();
    });

    it("Issues page distinguishes loading empty and failed states", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      let resolveList;
      IssueServices.listOpen.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
      const wrapper = await mountApp("/issues");
      expect(wrapper.find('[data-testid="issues-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("No issues found.");

      resolveList({ data: [] });
      await flushPromises();
      expect(wrapper.find('[data-testid="issues-loading"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("No issues found.");
      expect(rows(wrapper)).toHaveLength(0);
    });

    it("Issue list failure does not show an empty list", async () => {
      Utils.setStore("user", { ...account("admin"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("admin") });
      IssueServices.listOpen.mockRejectedValue(apiError(500, "Issue request failed."));
      let wrapper = await mountApp("/issues");
      expect(wrapper.text()).toContain("Issue request failed.");
      expect(wrapper.text()).not.toContain("No issues found.");
      expect(rows(wrapper)).toHaveLength(0);
      wrapper.unmount();
      mounted.pop();

      IssueServices.listOpen.mockRejectedValue(apiError(500));
      wrapper = await mountApp("/issues");
      expect(wrapper.text()).toContain("Issues could not be loaded.");
      expect(wrapper.text()).not.toContain("No issues found.");
    });
  });
});
