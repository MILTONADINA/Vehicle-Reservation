/**
 * Feature 8 — Request Processing (Frontend)
 * Spec: features/feature-8-request-processing.md
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
vi.mock("../src/services/areaServices.js", () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("../src/services/driverServices.js", () => ({
  default: { getOptions: vi.fn(), getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("../src/services/destinationServices.js", () => ({
  default: { getOptions: vi.fn(), getAll: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const areaAthletics = { id: 1, areaName: "Athletics", areaLogo: "https://example.org/logo.png", noticeEmail: "Return clean." };
const areaList = [areaAthletics];

const driverJordan = { id: 1, firstName: "Jordan", lastName: "Lee", licenseState: "OK", licenseExpireDate: "2028-06-30", approvedDate: "2026-01-15", status: "approved" };
const driverList = [driverJordan];

const destOKC = { id: 1, destinationName: "Oklahoma City Airport", addressLine: "7100 Terminal Drive", city: "Oklahoma City", state: "OK", zipCode: "73159", roundTripMiles: 120.5, status: "active" };
const destTulsa = { id: 2, destinationName: "Tulsa Downtown", addressLine: "100 South Main Street", city: "Tulsa", state: "OK", zipCode: "74103", roundTripMiles: 210, status: "active" };
const destList = [destOKC, destTulsa];

const reqRequested = {
  id: 1, requestorUserId: 99, areaId: 1, driverId: 1,
  destinationId: 1, destinationCity: null, estimatedMiles: null,
  departureDate: "2026-11-10", departureTime: "08:30",
  returnDate: "2026-11-10", returnTime: "17:00",
  passengers: 4, purpose: "Conference shuttle",
  noteType: null, noteText: null,
  status: "requested", vehicleId: null, statusReason: null,
};

const reqReserved = {
  id: 2, requestorUserId: 99, areaId: 1, driverId: 1,
  destinationId: 1, destinationCity: null, estimatedMiles: null,
  departureDate: "2026-11-12", departureTime: null,
  returnDate: "2026-11-13", returnTime: null,
  passengers: 2, purpose: "Field trip",
  noteType: null, noteText: null,
  status: "reserved", vehicleId: 5, statusReason: null,
};

const reqCancelled = {
  id: 3, requestorUserId: 99, areaId: 1, driverId: 1,
  destinationId: 2, destinationCity: null, estimatedMiles: null,
  departureDate: "2026-11-15", departureTime: "09:00",
  returnDate: "2026-11-15", returnTime: "18:00",
  passengers: 6, purpose: "Workshop",
  noteType: null, noteText: null,
  status: "cancelled", vehicleId: null, statusReason: "No vehicle available.",
};

const candidateVeh = {
  id: 5, make: "Ford", model: "Transit", year: 2024, vin: "1FTBW3XM8MKA00001",
  purchasedDate: "2024-01-15", color: "White", passengers: 8,
  plateNumber: "ABC123", plateExpireMonth: 6, designatedParking: "Lot A", areaId: 1,
};

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

function mockLists(list) {
  ReservationRequestServices.getAll.mockResolvedValue({ data: list });
  AreaServices.getAll.mockResolvedValue({ data: areaList });
  DriverServices.getAll.mockResolvedValue({ data: driverList });
  DestinationServices.getAll.mockResolvedValue({ data: destList });
}

async function openRequests(role, areaId, list) {
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

const rows = (wrapper) => wrapper.findAll('[data-testid="request-row"]');

beforeEach(async () => {
  localStorage.clear();
  vi.resetAllMocks();
  await router.push("/login");
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.querySelectorAll(".v-overlay-container").forEach((node) => node.remove());
});

describe("Feature 8 — Request Processing", () => {
  it("Processing page shows status actions on in-scope rows", async () => {
    const wrapper = await openRequests("admin", null, [reqRequested, reqReserved, reqCancelled]);

    const headers = wrapper.findAll("th");
    const headerTexts = headers.map((h) => h.text());
    expect(headerTexts).toContain("Vehicle");
    expect(headerTexts).toContain("Status reason");

    const allRows = rows(wrapper);
    expect(allRows).toHaveLength(3);

    expect(allRows[0].find('[data-testid="status-change"]').exists()).toBe(true);
    expect(allRows[0].find('[data-testid="mark-returned"]').exists()).toBe(false);

    expect(allRows[1].find('[data-testid="status-change"]').exists()).toBe(true);
    expect(allRows[1].find('[data-testid="mark-returned"]').exists()).toBe(true);
    expect(allRows[1].text()).toContain("5");

    expect(allRows[2].find('[data-testid="status-change"]').exists()).toBe(false);
    expect(allRows[2].find('[data-testid="mark-returned"]').exists()).toBe(false);
    expect(allRows[2].text()).toContain("No vehicle available.");
  });

  it("Requestor sees processed outcomes without processing actions", async () => {
    const reqReservedOwn = { ...reqReserved, requestorUserId: 7 };
    const reqCancelledOwn = { ...reqCancelled, requestorUserId: 7 };

    const wrapper = await openRequests("requestor", null, [reqReservedOwn, reqCancelledOwn]);

    const allRows = rows(wrapper);
    expect(allRows).toHaveLength(2);

    expect(allRows[0].text()).toContain("reserved");
    expect(allRows[0].text()).toContain("5");
    expect(allRows[1].text()).toContain("cancelled");
    expect(allRows[1].text()).toContain("No vehicle available.");

    expect(wrapper.findAll('[data-testid="status-change"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid="mark-returned"]')).toHaveLength(0);

    expect(allRows[0].find('[data-testid="edit-request"]').exists()).toBe(false);
    expect(allRows[1].find('[data-testid="edit-request"]').exists()).toBe(false);
  });

  it("Reserve dialog loads candidate vehicles", async () => {
    const wrapper = await openRequests("admin", null, [reqRequested]);
    ReservationRequestServices.getCandidateVehicles.mockResolvedValue({ data: [candidateVeh] });

    await rows(wrapper)[0].find('[data-testid="status-change"]').trigger("click");
    await flushPromises();
    expect(dialogOpen("status-dialog")).toBe(true);

    await choose("status-select", "reserved");
    await flushPromises();

    expect(ReservationRequestServices.getCandidateVehicles).toHaveBeenCalledWith(1);
    expect(byTestId("status-vehicle")).not.toBeNull();
  });

  it("Saving a status change refreshes the list", async () => {
    const wrapper = await openRequests("admin", null, [reqRequested]);

    await rows(wrapper)[0].find('[data-testid="status-change"]').trigger("click");
    await flushPromises();
    expect(dialogOpen("status-dialog")).toBe(true);

    await choose("status-select", "awaiting_vehicle");
    await flushPromises();

    let resolveSave;
    ReservationRequestServices.changeStatus.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    ReservationRequestServices.getAll.mockResolvedValue({ data: [{ ...reqRequested, status: "awaiting_vehicle" }] });

    await click("save-status");
    await click("save-status");
    expect(ReservationRequestServices.changeStatus).toHaveBeenCalledTimes(1);
    expect(ReservationRequestServices.changeStatus).toHaveBeenCalledWith(1, { status: "awaiting_vehicle" });
    expect(byTestId("save-status").disabled).toBe(true);

    resolveSave({ data: { ...reqRequested, status: "awaiting_vehicle" } });
    await flushPromises();

    expect(dialogOpen("status-dialog")).toBe(false);
    expect(ReservationRequestServices.getAll).toHaveBeenCalledTimes(2);
    expect(rows(wrapper)[0].text()).toContain("awaiting_vehicle");
  });

  it("Failed status change keeps the dialog open", async () => {
    const wrapper = await openRequests("admin", null, [reqRequested]);

    await rows(wrapper)[0].find('[data-testid="status-change"]').trigger("click");
    await flushPromises();
    await choose("status-select", "awaiting_vehicle");
    await flushPromises();

    ReservationRequestServices.changeStatus.mockRejectedValueOnce(apiError(400, "Invalid reservation request data."));
    await click("save-status");
    expect(dialogOpen("status-dialog")).toBe(true);
    expect(bodyText()).toContain("Invalid reservation request data.");

    ReservationRequestServices.changeStatus.mockRejectedValueOnce(new Error("Network Error"));
    await click("save-status");
    expect(dialogOpen("status-dialog")).toBe(true);
    expect(bodyText()).toContain("Reservation request could not be updated.");

    expect(rows(wrapper)).toHaveLength(1);
  });

  it("Cancel closes status change without a request", async () => {
    const wrapper = await openRequests("admin", null, [reqRequested]);

    await rows(wrapper)[0].find('[data-testid="status-change"]').trigger("click");
    await flushPromises();
    expect(dialogOpen("status-dialog")).toBe(true);

    await click("cancel-status");
    expect(ReservationRequestServices.changeStatus).not.toHaveBeenCalled();
    expect(dialogOpen("status-dialog")).toBe(false);
    expect(rows(wrapper)).toHaveLength(1);
  });
});
