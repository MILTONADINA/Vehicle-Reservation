/**
 * Feature 10 — Vehicle Issue Reports (request detail)
 * Spec: features/feature-10-vehicle-issue-reports.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import App from "../src/App.vue";
import router from "../src/router.js";
import AuthServices from "../src/services/authServices.js";
import ReservationRequestServices from "../src/services/reservationRequestServices.js";
import AreaServices from "../src/services/areaServices.js";
import DriverServices from "../src/services/driverServices.js";
import DestinationServices from "../src/services/destinationServices.js";
import IssueServices from "../src/services/issueServices.js";
import Utils from "../src/config/utils.js";
import { vuetify } from "./testUtils.js";

vi.mock("../src/services/authServices.js", () => ({
  default: { loginWithGoogle: vi.fn(), me: vi.fn(), logoutUser: vi.fn() },
}));
vi.mock("../src/services/reservationRequestServices.js", () => ({
  default: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    getCandidateVehicles: vi.fn(),
    changeStatus: vi.fn(),
  },
}));
vi.mock("../src/services/reservationEmailServices.js", () => ({
  default: { sendNow: vi.fn() },
}));
vi.mock("../src/services/areaServices.js", () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("../src/services/driverServices.js", () => ({
  default: { getOptions: vi.fn(), getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("../src/services/destinationServices.js", () => ({
  default: { getOptions: vi.fn(), getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("../src/services/issueServices.js", () => ({
  default: { listOpen: vi.fn(), listForRequest: vi.fn(), createForRequest: vi.fn() },
}));

const areaAthletics = { id: 1, areaName: "Athletics", areaLogo: "https://example.org/logo.png", noticeEmail: "Return clean." };
const driverJordan = {
  id: 1, firstName: "Jordan", lastName: "Lee", licenseState: "OK",
  licenseExpireDate: "2028-06-30", approvedDate: "2026-01-15", status: "approved",
};
const destOKC = {
  id: 1, destinationName: "Oklahoma City Airport", addressLine: "7100 Terminal Drive",
  city: "Oklahoma City", state: "OK", zipCode: "73159", roundTripMiles: 120.5, status: "active",
};

const ownRequest = {
  id: 10, requestorUserId: 7, areaId: 1, driverId: 1,
  destinationId: 1, destinationCity: null, estimatedMiles: null,
  departureDate: "2026-11-10", departureTime: "08:30",
  returnDate: "2026-11-10", returnTime: "17:00",
  passengers: 4, purpose: "Conference shuttle",
  noteType: null, noteText: null,
  status: "returned", vehicleId: 3, statusReason: null,
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

function mockLists(list = [ownRequest]) {
  ReservationRequestServices.getAll.mockResolvedValue({ data: list });
  AreaServices.getAll.mockResolvedValue({ data: [areaAthletics] });
  DriverServices.getAll.mockResolvedValue({ data: [driverJordan] });
  DestinationServices.getAll.mockResolvedValue({ data: [destOKC] });
  IssueServices.listForRequest.mockResolvedValue({ data: [] });
}

async function openRequests(role = "requestor", areaId = null, list = [ownRequest]) {
  Utils.setStore("user", { ...account(role, areaId), token: "session-token" });
  AuthServices.me.mockResolvedValue({ data: account(role, areaId) });
  mockLists(list);
  return mountApp("/reservation-requests");
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

beforeEach(async () => {
  localStorage.clear();
  vi.resetAllMocks();
  await router.push("/login");
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.querySelectorAll(".v-overlay-container").forEach((node) => node.remove());
});

describe("Feature 10 — Request Issues", () => {
  describe("US-10.1 — Report a vehicle issue", () => {
    it("Report issue opens the specified form", async () => {
      const wrapper = await openRequests("requestor");
      expect(wrapper.findAll('[data-testid="request-row"]')).toHaveLength(1);
      await wrapper.find('[data-testid="view-issues"]').trigger("click");
      await flushPromises();
      expect(wrapper.find('[data-testid="request-issues-section"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="report-issue"]').exists()).toBe(true);

      await wrapper.find('[data-testid="report-issue"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("issue-dialog")).toBe(true);
      expect(bodyText()).toContain("Issue type");
      expect(bodyText()).toContain("When");
      expect(bodyText()).toContain("Note");
      expect(byTestId("save-issue").textContent).toContain("Save");
      expect(byTestId("cancel-issue").textContent).toContain("Cancel");
    });

    it("Saving an issue refreshes the list", async () => {
      const created = {
        id: 1,
        requestId: 10,
        vehicleId: 3,
        issueType: "low_gas",
        timing: "after",
        note: "Tank was near empty on return.",
        reportedByUserId: 7,
        createdAt: "2026-10-27T18:00:00.000Z",
      };
      IssueServices.createForRequest.mockResolvedValue({ data: created });
      IssueServices.listForRequest
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [created] });

      const wrapper = await openRequests("requestor");
      await wrapper.find('[data-testid="view-issues"]').trigger("click");
      await flushPromises();
      await wrapper.find('[data-testid="report-issue"]').trigger("click");
      await flushPromises();
      await choose("issue-type", "low_gas");
      await choose("issue-timing", "after");
      await fill("issue-note", "Tank was near empty on return.");
      await click("save-issue");

      expect(IssueServices.createForRequest).toHaveBeenCalledWith(10, {
        issueType: "low_gas",
        timing: "after",
        note: "Tank was near empty on return.",
      });
      expect(dialogOpen("issue-dialog")).toBe(false);
      expect(wrapper.text()).toContain("Low gas");
      expect(wrapper.text()).toContain("After");
      expect(wrapper.text()).toContain("Tank was near empty on return.");
    });

    it("Saving an issue blocks duplicate submits", async () => {
      const created = {
        id: 2,
        requestId: 10,
        vehicleId: 3,
        issueType: "dirty",
        timing: "during",
        note: null,
        reportedByUserId: 7,
        createdAt: "2026-10-27T18:30:00.000Z",
      };
      let resolveSave;
      IssueServices.createForRequest.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
      IssueServices.listForRequest
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [created] });

      const wrapper = await openRequests("requestor");
      await wrapper.find('[data-testid="view-issues"]').trigger("click");
      await flushPromises();
      await wrapper.find('[data-testid="report-issue"]').trigger("click");
      await flushPromises();
      await choose("issue-type", "dirty");
      await choose("issue-timing", "during");
      await click("save-issue");
      await click("save-issue");
      expect(IssueServices.createForRequest).toHaveBeenCalledTimes(1);
      expect(IssueServices.createForRequest).toHaveBeenCalledWith(10, {
        issueType: "dirty",
        timing: "during",
      });
      expect(byTestId("save-issue").disabled).toBe(true);

      resolveSave({ data: created });
      await flushPromises();
      expect(dialogOpen("issue-dialog")).toBe(false);
      expect(IssueServices.listForRequest).toHaveBeenCalledTimes(2);
    });

    it("Failed issue save keeps the dialog open", async () => {
      IssueServices.createForRequest.mockRejectedValue(apiError(400, "Invalid issue data."));
      const wrapper = await openRequests("requestor");
      await wrapper.find('[data-testid="view-issues"]').trigger("click");
      await flushPromises();
      await wrapper.find('[data-testid="report-issue"]').trigger("click");
      await flushPromises();
      await choose("issue-type", "dirty");
      await choose("issue-timing", "during");
      await fill("issue-note", "Keep this note");
      await click("save-issue");

      expect(dialogOpen("issue-dialog")).toBe(true);
      expect(byTestId("issue-form-error").textContent).toContain("Invalid issue data.");
      expect(document.querySelector('[data-testid="issue-note"] textarea').value).toBe("Keep this note");

      IssueServices.createForRequest.mockRejectedValue(apiError(500));
      await click("save-issue");
      expect(dialogOpen("issue-dialog")).toBe(true);
      expect(byTestId("issue-form-error").textContent).toContain("Issue could not be saved.");
    });
  });
});
