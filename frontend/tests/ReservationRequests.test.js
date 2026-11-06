/**
 * Feature 7 — Reservation Requests
 * Spec: features/feature-7-reservation-requests.md
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
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), cancel: vi.fn(), getCandidateVehicles: vi.fn(), changeStatus: vi.fn() },
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
const areaAcademics = { id: 2, areaName: "Academics", areaLogo: "https://example.org/logo2.png", noticeEmail: "Keys." };
const areaList = [areaAthletics, areaAcademics];

const driverJordan = { id: 1, firstName: "Jordan", lastName: "Lee", licenseState: "OK", licenseExpireDate: "2028-06-30", approvedDate: "2026-01-15", status: "approved" };
const driverAvery = { id: 2, firstName: "Avery", lastName: "Smith", licenseState: "TX", licenseExpireDate: "2027-12-01", approvedDate: "2025-08-20", status: "approved" };
const driverInactive = { id: 3, firstName: "Inactive", lastName: "Driver", licenseState: "OK", licenseExpireDate: "2025-01-01", approvedDate: "2024-01-01", status: "inactive" };
const driverList = [driverJordan, driverAvery, driverInactive];

const destOKC = { id: 1, destinationName: "Oklahoma City Airport", addressLine: "7100 Terminal Drive", city: "Oklahoma City", state: "OK", zipCode: "73159", roundTripMiles: 120.5, status: "active" };
const destTulsa = { id: 2, destinationName: "Tulsa Downtown", addressLine: "100 South Main Street", city: "Tulsa", state: "OK", zipCode: "74103", roundTripMiles: 210, status: "active" };
const destInactive = { id: 3, destinationName: "Closed Place", addressLine: "1 Elm", city: "Nowhere", state: "OK", zipCode: "73000", roundTripMiles: 50, status: "inactive" };
const destList = [destOKC, destTulsa, destInactive];

const reqCatalog = {
  id: 1, requestorUserId: 7, areaId: 1, driverId: 1,
  destinationId: 1, destinationCity: null, estimatedMiles: null,
  departureDate: "2026-11-10", departureTime: "08:30",
  returnDate: "2026-11-10", returnTime: "17:00",
  passengers: 4, purpose: "Conference shuttle",
  noteType: "special_instructions", noteText: "Need wheelchair access",
  status: "requested",
};
const reqFreetext = {
  id: 2, requestorUserId: 7, areaId: 2, driverId: 2,
  destinationId: null, destinationCity: "Norman", estimatedMiles: 40.5,
  departureDate: "2026-11-12", departureTime: null,
  returnDate: "2026-11-13", returnTime: null,
  passengers: 2, purpose: "Campus visit",
  noteType: null, noteText: null,
  status: "requested",
};
const reqOther = {
  id: 3, requestorUserId: 99, areaId: 1, driverId: 1,
  destinationId: 2, destinationCity: null, estimatedMiles: null,
  departureDate: "2026-11-15", departureTime: "09:00",
  returnDate: "2026-11-15", returnTime: "18:00",
  passengers: 6, purpose: "Field trip",
  noteType: null, noteText: null,
  status: "requested",
};
const requestList = [reqCatalog, reqFreetext];

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

function mockLists(list = requestList) {
  ReservationRequestServices.getAll.mockResolvedValue({ data: list });
  AreaServices.getAll.mockResolvedValue({ data: areaList });
  DriverServices.getAll.mockResolvedValue({ data: driverList });
  DestinationServices.getAll.mockResolvedValue({ data: destList });
}

async function openRequests(role, areaId = null, list = requestList) {
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
function selectItems(id) {
  const field = byTestId(id);
  if (!field) throw new Error(`no element with data-testid=${id}`);
  let instance = field.__vueParentComponent;
  while (instance) {
    const props = instance.props || {};
    if (Array.isArray(props.items)) return props.items;
    instance = instance.parent;
  }
  throw new Error(`could not read select items for ${id}`);
}
const fieldValue = (id) => document.querySelector(`[data-testid="${id}"] input, [data-testid="${id}"] textarea`)?.value;
const rows = (wrapper) => wrapper.findAll('[data-testid="request-row"]');

async function fillValidRequest() {
  await choose("request-area", 1);
  await choose("request-driver", 1);
  await choose("request-destination", 1);
  await fill("request-dep-date", "2026-11-20");
  await fill("request-dep-time", "08:00");
  await fill("request-ret-date", "2026-11-20");
  await fill("request-ret-time", "17:00");
  await fill("request-passengers", "3");
  await fill("request-purpose", "Team meeting");
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

describe("Feature 7 — Reservation Requests", () => {
  describe("US-7.1 — View reservation requests", () => {
    it("Requests page shows allowed records and actions", async () => {
      Utils.setStore("user", { ...account("requestor"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("requestor") });
      mockLists();
      let wrapper = await mountApp("/");
      await wrapper.find('[data-testid="nav-requests"]').trigger("click");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("reservation-requests");
      expect(wrapper.find("h1").text()).toBe("Reservation requests");
      expect(rows(wrapper)).toHaveLength(2);
      expect(rows(wrapper)[0].text()).toContain("2026-11-10");
      expect(rows(wrapper)[0].text()).toContain("08:30");
      expect(rows(wrapper)[0].text()).toContain("Athletics");
      expect(rows(wrapper)[0].text()).toContain("Jordan Lee");
      expect(rows(wrapper)[0].text()).toContain("Oklahoma City Airport");
      expect(rows(wrapper)[0].text()).toContain("120.5");
      expect(rows(wrapper)[0].text()).toContain("4");
      expect(rows(wrapper)[0].text()).toContain("Conference shuttle");
      expect(rows(wrapper)[0].text()).toContain("special_instructions");
      expect(rows(wrapper)[0].text()).toContain("Need wheelchair access");
      expect(rows(wrapper)[0].text()).toContain("requested");
      expect(rows(wrapper)[1].text()).toContain("Norman");
      expect(rows(wrapper)[1].text()).toContain("40.5");
      expect(wrapper.find('[data-testid="add-request"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="edit-request"]')).toHaveLength(2);
      expect(wrapper.findAll('[data-testid="cancel-request"]')).toHaveLength(2);
      wrapper.unmount();
      mounted.pop();

      wrapper = await openRequests("admin");
      expect(rows(wrapper)).toHaveLength(2);
      expect(wrapper.find('[data-testid="add-request"]').exists()).toBe(false);
      expect(wrapper.findAll('[data-testid="edit-request"]')).toHaveLength(0);
      expect(wrapper.findAll('[data-testid="cancel-request"]')).toHaveLength(0);
      wrapper.unmount();
      mounted.pop();

      wrapper = await openRequests("area_admin", 2);
      expect(rows(wrapper)).toHaveLength(2);
      expect(wrapper.find('[data-testid="add-request"]').exists()).toBe(false);
      expect(wrapper.findAll('[data-testid="edit-request"]')).toHaveLength(0);
      expect(wrapper.findAll('[data-testid="cancel-request"]')).toHaveLength(0);
    });

    it("Requests navigation requires an allowed role", async () => {
      const wrapper = await mountApp("/reservation-requests");
      expect(router.currentRoute.value.name).toBe("login");
      expect(ReservationRequestServices.getAll).not.toHaveBeenCalled();
      expect(wrapper.findAll('[data-testid="request-row"]')).toHaveLength(0);
      expect(wrapper.find("h1").text()).toBe("Sign in");
    });

    it("Maintenance is sent Home from Requests", async () => {
      Utils.setStore("user", { ...account("maintenance"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("maintenance") });
      const wrapper = await mountApp("/");
      expect(wrapper.find('[data-testid="nav-requests"]').exists()).toBe(false);
      await router.push("/reservation-requests");
      await flushPromises();
      expect(router.currentRoute.value.name).toBe("home");
      expect(ReservationRequestServices.getAll).not.toHaveBeenCalled();
    });

    it("Requests page distinguishes loading empty and failed states", async () => {
      Utils.setStore("user", { ...account("requestor"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("requestor") });
      let resolveList;
      ReservationRequestServices.getAll.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));
      AreaServices.getAll.mockResolvedValue({ data: areaList });
      DriverServices.getAll.mockResolvedValue({ data: driverList });
      DestinationServices.getAll.mockResolvedValue({ data: destList });
      const wrapper = await mountApp("/reservation-requests");
      expect(wrapper.find('[data-testid="requests-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("No reservation requests found.");

      resolveList({ data: [] });
      await flushPromises();
      expect(wrapper.find('[data-testid="requests-loading"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("No reservation requests found.");
      expect(rows(wrapper)).toHaveLength(0);
    });

    it("Reservation request list failure does not show an empty list", async () => {
      Utils.setStore("user", { ...account("requestor"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("requestor") });
      AreaServices.getAll.mockResolvedValue({ data: areaList });
      DriverServices.getAll.mockResolvedValue({ data: driverList });
      DestinationServices.getAll.mockResolvedValue({ data: destList });
      ReservationRequestServices.getAll.mockRejectedValueOnce(apiError(500, "Reservation request failed."));
      const wrapper = await mountApp("/reservation-requests");
      expect(wrapper.text()).toContain("Reservation request failed.");
      expect(wrapper.text()).not.toContain("No reservation requests found.");
      wrapper.unmount();
      mounted.pop();

      ReservationRequestServices.getAll.mockRejectedValueOnce(new Error("Network Error"));
      AreaServices.getAll.mockResolvedValue({ data: areaList });
      DriverServices.getAll.mockResolvedValue({ data: driverList });
      DestinationServices.getAll.mockResolvedValue({ data: destList });
      const again = await mountApp("/reservation-requests");
      expect(again.text()).toContain("Reservation requests could not be loaded.");
      expect(again.text()).not.toContain("No reservation requests found.");
      expect(rows(again)).toHaveLength(0);
    });
  });

  describe("US-7.2 — Submit a reservation request", () => {
    it("Add request opens the specified form", async () => {
      const wrapper = await openRequests("requestor");
      await wrapper.find('[data-testid="add-request"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("request-dialog")).toBe(true);
      expect(bodyText()).toContain("Add request");
      expect(bodyText()).toContain("Area");
      expect(bodyText()).toContain("Driver");
      expect(bodyText()).toContain("Destination mode");
      expect(bodyText()).toContain("Catalog destination");
      expect(bodyText()).toContain("Free-text city");
      expect(bodyText()).toContain("Departure date");
      expect(bodyText()).toContain("Departure time");
      expect(bodyText()).toContain("Return date");
      expect(bodyText()).toContain("Return time");
      expect(bodyText()).toContain("Passengers");
      expect(bodyText()).toContain("Purpose");
      expect(bodyText()).toContain("Note type");
      expect(bodyText()).toContain("Note text");
      expect(byTestId("save-request").textContent).toContain("Save");
      expect(byTestId("cancel-dialog").textContent).toContain("Cancel");
    });

    it("Add request offers only approved drivers and active destinations", async () => {
      const wrapper = await openRequests("requestor");
      await wrapper.find('[data-testid="add-request"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("request-dialog")).toBe(true);
      expect(selectItems("request-driver").map((d) => d.id)).toEqual([driverJordan.id, driverAvery.id]);
      expect(selectItems("request-driver").every((d) => d.status === "approved")).toBe(true);
      expect(selectItems("request-destination").map((d) => d.id)).toEqual([destOKC.id, destTulsa.id]);
      expect(selectItems("request-destination").every((d) => d.status === "active")).toBe(true);
      wrapper.unmount();
      mounted.pop();
    });

    it("Edit and Cancel are hidden on non-requested rows", async () => {
      Utils.setStore("user", { ...account("requestor"), token: "session-token" });
      AuthServices.me.mockResolvedValue({ data: account("requestor") });
      const cancelledOwn = {
        ...reqCatalog,
        id: 20,
        status: "cancelled",
        purpose: "Already cancelled",
      };
      const awaitingOwn = {
        ...reqFreetext,
        id: 21,
        status: "awaiting_vehicle",
        purpose: "Waiting on vehicle",
      };
      ReservationRequestServices.getAll.mockResolvedValue({ data: [reqCatalog, cancelledOwn, awaitingOwn] });
      AreaServices.getAll.mockResolvedValue({ data: areaList });
      DriverServices.getAll.mockResolvedValue({ data: driverList });
      DestinationServices.getAll.mockResolvedValue({ data: destList });
      const wrapper = await mountApp("/reservation-requests");
      expect(rows(wrapper)).toHaveLength(3);
      expect(wrapper.findAll('[data-testid="edit-request"]')).toHaveLength(1);
      expect(wrapper.findAll('[data-testid="cancel-request"]')).toHaveLength(1);
      const actionable = rows(wrapper).find((row) => row.text().includes("Conference shuttle"));
      expect(actionable.find('[data-testid="edit-request"]').exists()).toBe(true);
      expect(actionable.find('[data-testid="cancel-request"]').exists()).toBe(true);
      for (const purpose of ["Already cancelled", "Waiting on vehicle"]) {
        const row = rows(wrapper).find((r) => r.text().includes(purpose));
        expect(row.find('[data-testid="edit-request"]').exists()).toBe(false);
        expect(row.find('[data-testid="cancel-request"]').exists()).toBe(false);
      }
      wrapper.unmount();
      mounted.pop();
    });

    it("Saving a reservation request updates the list", async () => {
      const wrapper = await openRequests("requestor");
      await wrapper.find('[data-testid="add-request"]').trigger("click");
      await flushPromises();
      await fillValidRequest();
      let resolveSave;
      ReservationRequestServices.create.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
      const created = {
        id: 10, requestorUserId: 7, areaId: 1, driverId: 1,
        destinationId: 1, destinationCity: null, estimatedMiles: null,
        departureDate: "2026-11-20", departureTime: "08:00",
        returnDate: "2026-11-20", returnTime: "17:00",
        passengers: 3, purpose: "Team meeting",
        noteType: null, noteText: null, status: "requested",
      };
      ReservationRequestServices.getAll.mockResolvedValue({ data: [...requestList, created] });
      await click("save-request");
      await click("save-request");
      expect(ReservationRequestServices.create).toHaveBeenCalledTimes(1);
      expect(ReservationRequestServices.create).toHaveBeenCalledWith(expect.objectContaining({
        areaId: 1, driverId: 1, destinationId: 1,
        departureDate: "2026-11-20", departureTime: "08:00",
        returnDate: "2026-11-20", returnTime: "17:00",
        passengers: 3, purpose: "Team meeting",
      }));
      expect(byTestId("save-request").disabled).toBe(true);

      resolveSave({ data: created });
      await flushPromises();
      expect(dialogOpen("request-dialog")).toBe(false);
      expect(ReservationRequestServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)).toHaveLength(3);
    });

    it("Cancel leaves reservation form changes unchanged", async () => {
      const wrapper = await openRequests("requestor");
      await wrapper.find('[data-testid="add-request"]').trigger("click");
      await flushPromises();
      await fill("request-purpose", "Draft trip");
      await click("save-request");
      expect(bodyText()).toContain("Invalid reservation request data.");
      await click("cancel-dialog");
      expect(ReservationRequestServices.create).not.toHaveBeenCalled();
      expect(dialogOpen("request-dialog")).toBe(false);

      await wrapper.find('[data-testid="add-request"]').trigger("click");
      await flushPromises();
      expect(fieldValue("request-purpose")).toBe("");
      expect(bodyText()).not.toContain("Invalid reservation request data.");
      await click("cancel-dialog");

      await rows(wrapper)[0].find('[data-testid="edit-request"]').trigger("click");
      await flushPromises();
      await fill("request-purpose", "Changed purpose");
      await click("cancel-dialog");
      expect(ReservationRequestServices.update).not.toHaveBeenCalled();
      await rows(wrapper)[0].find('[data-testid="edit-request"]').trigger("click");
      await flushPromises();
      expect(fieldValue("request-purpose")).toBe("Conference shuttle");
    });

    it("Reservation request form rejects invalid fields before submitting", async () => {
      const wrapper = await openRequests("requestor");
      await wrapper.find('[data-testid="add-request"]').trigger("click");
      await flushPromises();
      await click("save-request");
      expect(bodyText()).toContain("Invalid reservation request data.");
      expect(dialogOpen("request-dialog")).toBe(true);
      expect(ReservationRequestServices.create).not.toHaveBeenCalled();
    });

    it("Failed reservation request save keeps the dialog open", async () => {
      const wrapper = await openRequests("requestor");
      await wrapper.find('[data-testid="add-request"]').trigger("click");
      await flushPromises();
      await fillValidRequest();
      ReservationRequestServices.create.mockRejectedValueOnce(apiError(500, "Reservation request failed."));
      await click("save-request");
      expect(dialogOpen("request-dialog")).toBe(true);
      expect(bodyText()).toContain("Reservation request failed.");
      expect(fieldValue("request-purpose")).toBe("Team meeting");

      ReservationRequestServices.create.mockRejectedValueOnce(new Error("Network Error"));
      await click("save-request");
      expect(dialogOpen("request-dialog")).toBe(true);
      expect(bodyText()).toContain("Reservation request could not be saved.");
      expect(rows(wrapper)).toHaveLength(2);
    });
  });

  describe("US-7.3 — Edit a requested reservation request", () => {
    it("Edit request opens with the current values", async () => {
      const wrapper = await openRequests("requestor");
      await rows(wrapper)[0].find('[data-testid="edit-request"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("request-dialog")).toBe(true);
      expect(bodyText()).toContain("Edit request");
      expect(fieldValue("request-dep-date")).toBe("2026-11-10");
      expect(fieldValue("request-dep-time")).toBe("08:30");
      expect(fieldValue("request-ret-date")).toBe("2026-11-10");
      expect(fieldValue("request-ret-time")).toBe("17:00");
      expect(fieldValue("request-passengers")).toBe("4");
      expect(fieldValue("request-purpose")).toBe("Conference shuttle");
      expect(fieldValue("request-note-text")).toBe("Need wheelchair access");
      expect(byTestId("save-request").textContent).toContain("Save");
      expect(byTestId("cancel-dialog").textContent).toContain("Cancel");
    });

    it("Saving an edited reservation request refreshes the list", async () => {
      const wrapper = await openRequests("requestor");
      await rows(wrapper)[0].find('[data-testid="edit-request"]').trigger("click");
      await flushPromises();
      await fill("request-purpose", "Updated shuttle");
      ReservationRequestServices.update.mockResolvedValue({ data: { ...reqCatalog, purpose: "Updated shuttle" } });
      ReservationRequestServices.getAll.mockResolvedValue({ data: [{ ...reqCatalog, purpose: "Updated shuttle" }, reqFreetext] });
      await click("save-request");
      expect(ReservationRequestServices.update).toHaveBeenCalledWith(1, expect.objectContaining({
        purpose: "Updated shuttle",
        areaId: 1,
        driverId: 1,
      }));
      expect(dialogOpen("request-dialog")).toBe(false);
      expect(ReservationRequestServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)[0].text()).toContain("Updated shuttle");
    });
  });

  describe("US-7.4 — Cancel a requested reservation request", () => {
    it("Cancel request requires confirmation", async () => {
      const wrapper = await openRequests("requestor");
      await rows(wrapper)[0].find('[data-testid="cancel-request"]').trigger("click");
      await flushPromises();
      expect(dialogOpen("cancel-request-dialog")).toBe(true);
      expect(bodyText()).toContain("Cancel this reservation request?");
      expect(byTestId("confirm-cancel-request").textContent).toContain("Cancel request");
      expect(byTestId("keep-request").textContent).toContain("Keep");
    });

    it("Confirmed reservation request cancel refreshes the list", async () => {
      const wrapper = await openRequests("requestor");
      await rows(wrapper)[0].find('[data-testid="cancel-request"]').trigger("click");
      await flushPromises();
      let resolveCancel;
      ReservationRequestServices.cancel.mockReturnValue(new Promise((resolve) => { resolveCancel = resolve; }));
      ReservationRequestServices.getAll.mockResolvedValue({ data: [{ ...reqCatalog, status: "cancelled" }, reqFreetext] });
      await click("confirm-cancel-request");
      await click("confirm-cancel-request");
      expect(ReservationRequestServices.cancel).toHaveBeenCalledTimes(1);
      expect(ReservationRequestServices.cancel).toHaveBeenCalledWith(1);
      expect(byTestId("confirm-cancel-request").disabled).toBe(true);

      resolveCancel({ data: { ...reqCatalog, status: "cancelled" } });
      await flushPromises();
      expect(dialogOpen("cancel-request-dialog")).toBe(false);
      expect(ReservationRequestServices.getAll).toHaveBeenCalledTimes(2);
      expect(rows(wrapper)[0].text()).toContain("cancelled");
    });

    it("Failed reservation request cancel preserves the dialog and row", async () => {
      const wrapper = await openRequests("requestor");
      await rows(wrapper)[0].find('[data-testid="cancel-request"]').trigger("click");
      await flushPromises();
      ReservationRequestServices.cancel.mockRejectedValueOnce(apiError(500, "Reservation request failed."));
      await click("confirm-cancel-request");
      expect(dialogOpen("cancel-request-dialog")).toBe(true);
      expect(bodyText()).toContain("Reservation request failed.");
      expect(rows(wrapper)).toHaveLength(2);

      ReservationRequestServices.cancel.mockRejectedValueOnce(new Error("Network Error"));
      await click("confirm-cancel-request");
      expect(dialogOpen("cancel-request-dialog")).toBe(true);
      expect(bodyText()).toContain("Reservation request could not be canceled.");
      expect(rows(wrapper)).toHaveLength(2);
    });

    it("Keep closes cancel without a request", async () => {
      const wrapper = await openRequests("requestor");
      await rows(wrapper)[0].find('[data-testid="cancel-request"]').trigger("click");
      await flushPromises();
      await click("keep-request");
      expect(ReservationRequestServices.cancel).not.toHaveBeenCalled();
      expect(dialogOpen("cancel-request-dialog")).toBe(false);
      expect(rows(wrapper)).toHaveLength(2);
    });
  });
});
