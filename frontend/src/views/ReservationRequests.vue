<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import ReservationRequestServices from "../services/reservationRequestServices.js";
import ReservationEmailServices from "../services/reservationEmailServices.js";
import AreaServices from "../services/areaServices.js";
import DriverServices from "../services/driverServices.js";
import DestinationServices from "../services/destinationServices.js";
import IssueServices from "../services/issueServices.js";
import Utils from "../config/utils.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MILES_PATTERN = /^\d+(\.\d)?$/;
const NOTE_TYPES = ["general", "special_instructions", "other"];
const NOTE_TYPE_SET = new Set(NOTE_TYPES);
const ISSUE_TYPES = [
  { title: "Low gas", value: "low_gas" },
  { title: "Dirty", value: "dirty" },
  { title: "Maintenance need", value: "maintenance_need" },
];
const ISSUE_TIMINGS = [
  { title: "Before", value: "before" },
  { title: "During", value: "during" },
  { title: "After", value: "after" },
];
const ISSUE_TYPE_LABELS = {
  low_gas: "Low gas",
  dirty: "Dirty",
  maintenance_need: "Maintenance need",
};
const TIMING_LABELS = {
  before: "Before",
  during: "During",
  after: "After",
};

const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const isRequestor = computed(() => user.value?.role === "requestor");
const isAdmin = computed(() => user.value?.role === "admin");
const isAreaAdmin = computed(() => user.value?.role === "area_admin");
const isProcessor = computed(() => isAdmin.value || isAreaAdmin.value);

const STATUS_TRANSITIONS = {
  requested: ["awaiting_vehicle", "reserved", "cancelled"],
  awaiting_vehicle: ["reserved", "cancelled"],
  reserved: ["returned", "cancelled"],
};

const STATUS_LABELS = {
  requested: "Requested",
  awaiting_vehicle: "Awaiting Vehicle",
  reserved: "Reserved",
  returned: "Returned",
  cancelled: "Cancelled",
};

function allowedTransitions(req) {
  return STATUS_TRANSITIONS[req.status] || [];
}

// Feature 9: admin-only Send now runs the shared email cycle and shows only its returned counts.
const SEND_NOW_FAILED = "Emails could not be processed.";
const SEND_NOW_COUNTS = [
  ["queued", "Queued"],
  ["sent", "Sent"],
  ["retryScheduled", "Retry scheduled"],
  ["failed", "Failed"],
  ["skipped", "Skipped"],
];
const sendNowState = reactive({ running: false, counts: null, error: "" });

async function sendDueEmails() {
  if (sendNowState.running) return;
  sendNowState.running = true;
  sendNowState.counts = null;
  sendNowState.error = "";
  try {
    const { data } = await ReservationEmailServices.sendNow();
    sendNowState.counts = Object.fromEntries(SEND_NOW_COUNTS.map(([key]) => [key, Number(data?.[key]) || 0]));
  } catch (error) {
    const status = error?.response?.status;
    // 401 and 403 keep Feature 1's app-wide handling (sign-in redirect, Forbidden alert).
    if (status !== 401 && status !== 403) sendNowState.error = error?.response?.data?.message || SEND_NOW_FAILED;
  } finally {
    sendNowState.running = false;
  }
}

const requests = ref([]);
const areas = ref([]);
const drivers = ref([]);
const destinations = ref([]);
const loading = ref(false);
const loaded = ref(false);
const loadError = ref("");

const areaMap = computed(() => {
  const map = {};
  for (const a of areas.value) map[a.id] = a;
  return map;
});
const driverMap = computed(() => {
  const map = {};
  for (const d of drivers.value) map[d.id] = d;
  return map;
});
const destinationMap = computed(() => {
  const map = {};
  for (const d of destinations.value) map[d.id] = d;
  return map;
});

const approvedDrivers = computed(() => drivers.value.filter((d) => d.status === "approved"));
const activeDestinations = computed(() => destinations.value.filter((d) => d.status === "active"));

function displayDestination(req) {
  if (req.destinationId) {
    const dest = destinationMap.value[req.destinationId];
    return dest ? dest.destinationName : "";
  }
  return req.destinationCity || "";
}

function displayMiles(req) {
  if (req.destinationId) {
    const dest = destinationMap.value[req.destinationId];
    return dest ? dest.roundTripMiles : "";
  }
  return req.estimatedMiles ?? "";
}

function displayArea(req) {
  const area = areaMap.value[req.areaId];
  return area ? area.areaName : "";
}

function displayDriver(req) {
  const driver = driverMap.value[req.driverId];
  return driver ? `${driver.firstName} ${driver.lastName}` : "";
}

function displayNotes(req) {
  if (!req.noteType) return "";
  return `${req.noteType}: ${req.noteText}`;
}

function displayDeparture(req) {
  return req.departureTime ? `${req.departureDate} ${req.departureTime}` : req.departureDate;
}

function displayReturn(req) {
  return req.returnTime ? `${req.returnDate} ${req.returnTime}` : req.returnDate;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    // Load the request list on its own so a catalog failure cannot hide a successful list (FR-023).
    const reqResult = await ReservationRequestServices.getAll();
    requests.value = reqResult.data;
    loaded.value = true;
    try {
      const [areaResult, driverResult, destResult] = await Promise.all([
        AreaServices.getAll(),
        DriverServices.getAll(),
        DestinationServices.getAll(),
      ]);
      areas.value = areaResult.data;
      drivers.value = driverResult.data;
      destinations.value = destResult.data;
    } catch {
      // Display names fall back to ids when catalogs cannot load.
    }
  } catch (reason) {
    loadError.value = reason.response?.data?.message || "Reservation requests could not be loaded.";
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const isCalendarDate = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const isValidTime = (value) => typeof value === "string" && TIME_PATTERN.test(value);

const parseMiles = (value) => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    value = String(value);
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!MILES_PATTERN.test(text)) return null;
  const miles = Number(text);
  if (!(miles > 0 && miles <= 9999.9)) return null;
  return miles;
};

const trimmedField = (value, limit) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= limit ? text : null;
};

function validRequestFields(form) {
  const areaId = typeof form.areaId === "number" && Number.isInteger(form.areaId) && form.areaId > 0 ? form.areaId : null;
  if (areaId === null) return null;

  const driverId = typeof form.driverId === "number" && Number.isInteger(form.driverId) && form.driverId > 0 ? form.driverId : null;
  if (driverId === null) return null;

  let destinationId = null;
  let destinationCity = null;
  let estimatedMiles = null;

  if (form.destinationMode === "catalog") {
    destinationId = typeof form.destinationId === "number" && Number.isInteger(form.destinationId) && form.destinationId > 0 ? form.destinationId : null;
    if (destinationId === null) return null;
  } else {
    destinationCity = trimmedField(form.destinationCity, 100);
    if (!destinationCity) return null;
    estimatedMiles = parseMiles(form.estimatedMiles);
    if (estimatedMiles === null) return null;
  }

  if (!isCalendarDate(form.departureDate) || !isCalendarDate(form.returnDate)) return null;
  const departureDate = form.departureDate;
  const returnDate = form.returnDate;

  let departureTime = null;
  let returnTime = null;
  const hasDepTime = form.departureTime !== null && form.departureTime !== undefined && form.departureTime !== "";
  const hasRetTime = form.returnTime !== null && form.returnTime !== undefined && form.returnTime !== "";

  if (!hasDepTime && !hasRetTime) {
    if (returnDate < departureDate) return null;
  } else if (hasDepTime && hasRetTime) {
    if (!isValidTime(form.departureTime) || !isValidTime(form.returnTime)) return null;
    departureTime = form.departureTime;
    returnTime = form.returnTime;
    const depCombined = `${departureDate}T${departureTime}`;
    const retCombined = `${returnDate}T${returnTime}`;
    if (retCombined <= depCombined) return null;
  } else {
    return null;
  }

  let passengers = null;
  if (typeof form.passengers === "number" && Number.isInteger(form.passengers)) {
    passengers = form.passengers;
  } else if (typeof form.passengers === "string" && /^\d+$/.test(form.passengers.trim())) {
    passengers = Number(form.passengers.trim());
  }
  if (passengers === null || passengers < 1 || passengers > 15) return null;

  const purpose = trimmedField(form.purpose, 500);
  if (!purpose) return null;

  let noteType = null;
  let noteText = null;
  const hasNoteType = form.noteType !== null && form.noteType !== undefined && form.noteType !== "";
  const hasNoteText = form.noteText !== null && form.noteText !== undefined && String(form.noteText).trim() !== "";
  if (hasNoteType || hasNoteText) {
    if (!hasNoteType || !hasNoteText) return null;
    if (!NOTE_TYPE_SET.has(form.noteType)) return null;
    noteType = form.noteType;
    noteText = trimmedField(form.noteText, 1000);
    if (!noteText) return null;
  }

  return {
    areaId, driverId, destinationId, destinationCity, estimatedMiles,
    departureDate, departureTime, returnDate, returnTime,
    passengers, purpose, noteType, noteText,
  };
}

const INVALID = "Invalid reservation request data.";

const emptyForm = () => ({
  areaId: null,
  driverId: null,
  destinationMode: "catalog",
  destinationId: null,
  destinationCity: "",
  estimatedMiles: "",
  departureDate: "",
  departureTime: "",
  returnDate: "",
  returnTime: "",
  passengers: null,
  purpose: "",
  noteType: null,
  noteText: "",
});

const dialog = reactive({ open: false, editing: null, saving: false, error: "", form: emptyForm() });
const formRef = ref(null);

async function openDialog(editing, form) {
  dialog.editing = editing;
  dialog.form = form;
  dialog.error = "";
  dialog.open = true;
  await nextTick();
  formRef.value?.resetValidation();
}

const openAdd = () => openDialog(null, emptyForm());

const openEdit = (req) => openDialog(req, {
  areaId: req.areaId,
  driverId: req.driverId,
  destinationMode: req.destinationId ? "catalog" : "freetext",
  destinationId: req.destinationId,
  destinationCity: req.destinationCity || "",
  estimatedMiles: req.estimatedMiles !== null ? String(req.estimatedMiles) : "",
  departureDate: req.departureDate,
  departureTime: req.departureTime || "",
  returnDate: req.returnDate,
  returnTime: req.returnTime || "",
  passengers: req.passengers,
  purpose: req.purpose,
  noteType: req.noteType,
  noteText: req.noteText || "",
});

function cancelDialog() {
  formRef.value?.resetValidation();
  dialog.open = false;
  dialog.error = "";
  dialog.form = emptyForm();
}

async function save() {
  if (dialog.saving) return;
  const fields = validRequestFields(dialog.form);
  if (!fields) {
    dialog.error = INVALID;
    return;
  }
  dialog.saving = true;
  dialog.error = "";
  try {
    if (dialog.editing) {
      await ReservationRequestServices.update(dialog.editing.id, fields);
    } else {
      await ReservationRequestServices.create(fields);
    }
    dialog.open = false;
    dialog.form = emptyForm();
    await load();
  } catch (reason) {
    dialog.error = reason.response?.data?.message || "Reservation request could not be saved.";
  } finally {
    dialog.saving = false;
  }
}

const cancellation = reactive({ open: false, request: null, canceling: false, error: "" });

function openCancel(req) {
  cancellation.request = req;
  cancellation.error = "";
  cancellation.open = true;
}

function keepCancel() {
  cancellation.open = false;
  cancellation.error = "";
}

async function confirmCancel() {
  if (cancellation.canceling) return;
  cancellation.canceling = true;
  cancellation.error = "";
  try {
    await ReservationRequestServices.cancel(cancellation.request.id);
    cancellation.open = false;
    await load();
  } catch (reason) {
    cancellation.error = reason.response?.data?.message || "Reservation request could not be canceled.";
  } finally {
    cancellation.canceling = false;
  }
}

const statusDialog = reactive({
  open: false,
  request: null,
  saving: false,
  error: "",
  form: { status: null, vehicleId: null, statusReason: "" },
});
const candidateVehicles = ref([]);
const loadingCandidates = ref(false);

const statusOptions = computed(() => {
  if (!statusDialog.request) return [];
  return allowedTransitions(statusDialog.request).map((s) => ({
    title: STATUS_LABELS[s] || s,
    value: s,
  }));
});

function openStatusDialog(req) {
  statusDialog.request = req;
  statusDialog.error = "";
  statusDialog.saving = false;
  candidateVehicles.value = [];
  statusDialog.form.status = null;
  statusDialog.form.vehicleId = null;
  statusDialog.form.statusReason = "";
  statusDialog.open = true;
}

function openMarkReturned(req) {
  statusDialog.request = req;
  statusDialog.error = "";
  statusDialog.saving = false;
  candidateVehicles.value = [];
  statusDialog.form.vehicleId = null;
  statusDialog.form.statusReason = "";
  statusDialog.open = true;
  statusDialog.form.status = "returned";
}

async function loadCandidates(requestId) {
  loadingCandidates.value = true;
  statusDialog.error = "";
  try {
    const result = await ReservationRequestServices.getCandidateVehicles(requestId);
    candidateVehicles.value = result.data;
  } catch (reason) {
    candidateVehicles.value = [];
    statusDialog.error = reason.response?.data?.message || "Candidate vehicles could not be loaded.";
  } finally {
    loadingCandidates.value = false;
  }
}

watch(() => statusDialog.form.status, (newVal) => {
  if (!statusDialog.open) return;
  if (newVal === "reserved" && statusDialog.request) {
    statusDialog.form.vehicleId = null;
    loadCandidates(statusDialog.request.id);
  } else {
    candidateVehicles.value = [];
    statusDialog.form.vehicleId = null;
  }
});

function cancelStatusDialog() {
  statusDialog.open = false;
  statusDialog.error = "";
  statusDialog.form.status = null;
  statusDialog.form.vehicleId = null;
  statusDialog.form.statusReason = "";
  candidateVehicles.value = [];
}

async function saveStatus() {
  if (statusDialog.saving) return;

  // Client-side validation before API call
  if (!statusDialog.form.status) {
    statusDialog.error = INVALID;
    return;
  }
  if (statusDialog.form.status === "reserved" && !statusDialog.form.vehicleId) {
    statusDialog.error = INVALID;
    return;
  }
  if (statusDialog.form.statusReason != null && statusDialog.form.statusReason !== "") {
    const trimmedLen = typeof statusDialog.form.statusReason === "string" ? statusDialog.form.statusReason.trim().length : -1;
    if (trimmedLen < 0 || trimmedLen > 500) {
      statusDialog.error = INVALID;
      return;
    }
  }

  const data = { status: statusDialog.form.status };

  if (statusDialog.form.status === "reserved") {
    data.vehicleId = statusDialog.form.vehicleId;
  }

  if (statusDialog.form.status === "cancelled") {
    const reason = typeof statusDialog.form.statusReason === "string" ? statusDialog.form.statusReason.trim() : "";
    if (reason) {
      data.statusReason = reason;
    }
  }

  statusDialog.saving = true;
  statusDialog.error = "";
  try {
    await ReservationRequestServices.changeStatus(statusDialog.request.id, data);
    statusDialog.open = false;
    statusDialog.form.status = null;
    statusDialog.form.vehicleId = null;
    statusDialog.form.statusReason = "";
    candidateVehicles.value = [];
    await load();
  } catch (reason) {
    statusDialog.error = reason.response?.data?.message || "Reservation request could not be updated.";
  } finally {
    statusDialog.saving = false;
  }
}

function canViewRequestIssues(req) {
  if (!req) return false;
  if (isAdmin.value) return true;
  if (isAreaAdmin.value) return req.areaId === user.value?.areaId;
  if (isRequestor.value) return req.requestorUserId === user.value?.userId;
  return false;
}

function canReportIssue(req) {
  return canViewRequestIssues(req);
}

const selectedRequest = ref(null);
const requestIssues = ref([]);
const issuesLoading = ref(false);
const issuesLoaded = ref(false);
const issuesError = ref("");

async function loadRequestIssues(requestId) {
  issuesLoading.value = true;
  issuesError.value = "";
  try {
    const { data } = await IssueServices.listForRequest(requestId);
    requestIssues.value = data;
    issuesLoaded.value = true;
  } catch (reason) {
    requestIssues.value = [];
    issuesError.value = reason.response?.data?.message || "Issues could not be loaded.";
  } finally {
    issuesLoading.value = false;
  }
}

async function openRequestIssues(req) {
  if (!canViewRequestIssues(req)) return;
  selectedRequest.value = req;
  issuesLoaded.value = false;
  requestIssues.value = [];
  await loadRequestIssues(req.id);
}

function reporterLabel(issue) {
  if (issue.reportedByUserId === user.value?.userId) {
    return `${user.value.firstName} ${user.value.lastName}`.trim();
  }
  return `User ${issue.reportedByUserId}`;
}

const issueDialog = reactive({
  open: false,
  saving: false,
  error: "",
  form: { issueType: null, timing: null, note: "" },
});
const issueFormRef = ref(null);

function emptyIssueForm() {
  return { issueType: null, timing: null, note: "" };
}

async function openIssueDialog() {
  if (!selectedRequest.value || !canReportIssue(selectedRequest.value)) return;
  issueDialog.form = emptyIssueForm();
  issueDialog.error = "";
  issueDialog.open = true;
  await nextTick();
  issueFormRef.value?.resetValidation();
}

function cancelIssueDialog() {
  issueFormRef.value?.resetValidation();
  issueDialog.open = false;
  issueDialog.error = "";
  issueDialog.form = emptyIssueForm();
}

function validIssueFields(form) {
  if (!ISSUE_TYPES.some((item) => item.value === form.issueType)) return null;
  if (!ISSUE_TIMINGS.some((item) => item.value === form.timing)) return null;
  let note = null;
  if (form.note !== null && form.note !== undefined && form.note !== "") {
    if (typeof form.note !== "string") return null;
    const trimmed = form.note.trim();
    if (trimmed.length > 1000) return null;
    note = trimmed.length === 0 ? null : trimmed;
  }
  return { issueType: form.issueType, timing: form.timing, note };
}

async function saveIssue() {
  if (issueDialog.saving || !selectedRequest.value) return;
  const fields = validIssueFields(issueDialog.form);
  if (!fields) {
    issueDialog.error = "Invalid issue data.";
    return;
  }
  const body = { issueType: fields.issueType, timing: fields.timing };
  if (fields.note !== null) body.note = fields.note;

  issueDialog.saving = true;
  issueDialog.error = "";
  try {
    await IssueServices.createForRequest(selectedRequest.value.id, body);
    issueDialog.open = false;
    issueDialog.form = emptyIssueForm();
    await loadRequestIssues(selectedRequest.value.id);
  } catch (reason) {
    issueDialog.error = reason.response?.data?.message || "Issue could not be saved.";
  } finally {
    issueDialog.saving = false;
  }
}
</script>

<template>
  <v-container class="py-10">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Reservation requests</h1>
      <div class="d-flex align-center ga-2">
        <v-btn
          v-if="isAdmin"
          color="primary"
          variant="outlined"
          :loading="sendNowState.running"
          :disabled="sendNowState.running"
          data-testid="send-now"
          @click="sendDueEmails"
        >Send now</v-btn>
        <v-btn v-if="isRequestor" color="primary" variant="elevated" class="oc-cta" data-testid="add-request" @click="openAdd">Add request</v-btn>
      </div>
    </div>

    <template v-if="isAdmin">
      <v-alert v-if="sendNowState.counts" type="info" density="compact" class="mb-4" data-testid="send-now-result">
        <span v-for="[key, label] in SEND_NOW_COUNTS" :key="key" class="mr-4" :data-testid="`send-now-${key}`">{{ label }}: {{ sendNowState.counts[key] }}</span>
      </v-alert>
      <v-alert v-if="sendNowState.error" type="error" density="compact" class="mb-4" data-testid="send-now-error">{{ sendNowState.error }}</v-alert>
    </template>

    <v-progress-circular v-if="loading" indeterminate color="primary" data-testid="requests-loading" />
    <v-alert v-else-if="loadError" type="error" density="compact" data-testid="requests-error">{{ loadError }}</v-alert>
    <p v-else-if="loaded && requests.length === 0" class="text-body-1" data-testid="requests-empty">No reservation requests found.</p>

    <v-table v-if="!loading && !loadError && requests.length > 0">
      <thead>
        <tr>
          <th>Departure</th>
          <th>Return</th>
          <th>Area</th>
          <th>Driver</th>
          <th>Destination</th>
          <th>Miles</th>
          <th>Passengers</th>
          <th>Purpose</th>
          <th>Notes</th>
          <th>Status</th>
          <th>Vehicle</th>
          <th>Status reason</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="req in requests" :key="req.id" data-testid="request-row">
          <td>{{ displayDeparture(req) }}</td>
          <td>{{ displayReturn(req) }}</td>
          <td>{{ displayArea(req) }}</td>
          <td>{{ displayDriver(req) }}</td>
          <td>{{ displayDestination(req) }}</td>
          <td>{{ displayMiles(req) }}</td>
          <td>{{ req.passengers }}</td>
          <td>{{ req.purpose }}</td>
          <td>{{ displayNotes(req) }}</td>
          <td>{{ req.status }}</td>
          <td>{{ req.vehicleId }}</td>
          <td>{{ req.statusReason }}</td>
          <td>
            <v-btn v-if="isRequestor && req.requestorUserId === user?.userId && req.status === 'requested'" size="small" variant="text" color="primary" data-testid="edit-request" @click="openEdit(req)">Edit</v-btn>
            <v-btn v-if="isRequestor && req.requestorUserId === user?.userId && req.status === 'requested'" size="small" variant="text" color="error" data-testid="cancel-request" @click="openCancel(req)">Cancel</v-btn>
            <v-btn v-if="isProcessor && allowedTransitions(req).length > 0" size="small" variant="text" color="primary" data-testid="status-change" @click="openStatusDialog(req)">Change status</v-btn>
            <v-btn v-if="isProcessor && req.status === 'reserved'" size="small" variant="text" color="success" data-testid="mark-returned" @click="openMarkReturned(req)">Mark returned</v-btn>
            <v-btn v-if="canViewRequestIssues(req)" size="small" variant="text" color="primary" data-testid="view-issues" @click="openRequestIssues(req)">Issues</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <div v-if="selectedRequest" class="mt-8" data-testid="request-issues-section">
      <div class="d-flex align-center justify-space-between mb-4">
        <h2 class="text-h5">Issues for request {{ selectedRequest.id }}</h2>
        <v-btn
          v-if="canReportIssue(selectedRequest)"
          color="primary"
          variant="elevated"
          class="oc-cta"
          data-testid="report-issue"
          @click="openIssueDialog"
        >Report issue</v-btn>
      </div>

      <v-progress-circular v-if="issuesLoading" indeterminate color="primary" data-testid="request-issues-loading" />
      <v-alert v-else-if="issuesError" type="error" density="compact" data-testid="request-issues-error">{{ issuesError }}</v-alert>
      <p v-else-if="issuesLoaded && requestIssues.length === 0" class="text-body-1" data-testid="request-issues-empty">No issues found.</p>

      <v-table v-if="!issuesLoading && !issuesError && requestIssues.length > 0" data-testid="request-issues-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>When</th>
            <th>Note</th>
            <th>Reporter</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="issue in requestIssues" :key="issue.id" data-testid="request-issue-row">
            <td>{{ ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType }}</td>
            <td>{{ TIMING_LABELS[issue.timing] || issue.timing }}</td>
            <td>{{ issue.note || "" }}</td>
            <td>{{ reporterLabel(issue) }}</td>
            <td>{{ issue.createdAt ? new Date(issue.createdAt).toLocaleString() : "" }}</td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <v-dialog v-model="dialog.open" max-width="640" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="request-dialog">
        <h2 class="text-h6 mb-4">{{ dialog.editing ? "Edit request" : "Add request" }}</h2>
        <v-alert v-if="dialog.error" type="error" density="compact" class="mb-4" data-testid="request-form-error">{{ dialog.error }}</v-alert>
        <v-form ref="formRef" @submit.prevent="save">
          <v-select
            v-model="dialog.form.areaId"
            label="Area"
            :items="areas"
            item-title="areaName"
            item-value="id"
            data-testid="request-area"
          />
          <v-select
            v-model="dialog.form.driverId"
            label="Driver"
            :items="approvedDrivers"
            :item-title="(d) => `${d.firstName} ${d.lastName}`"
            item-value="id"
            data-testid="request-driver"
          />
          <v-radio-group v-model="dialog.form.destinationMode" inline label="Destination mode" data-testid="request-dest-mode">
            <v-radio label="Catalog destination" value="catalog" />
            <v-radio label="Free-text city" value="freetext" />
          </v-radio-group>
          <v-select
            v-if="dialog.form.destinationMode === 'catalog'"
            v-model="dialog.form.destinationId"
            label="Destination"
            :items="activeDestinations"
            item-title="destinationName"
            item-value="id"
            data-testid="request-destination"
          />
          <template v-if="dialog.form.destinationMode === 'freetext'">
            <v-text-field v-model="dialog.form.destinationCity" label="City" maxlength="100" data-testid="request-city" />
            <v-text-field v-model="dialog.form.estimatedMiles" label="Estimated miles" type="number" step="0.1" min="0.1" max="9999.9" data-testid="request-est-miles" />
          </template>
          <v-text-field v-model="dialog.form.departureDate" label="Departure date" type="date" data-testid="request-dep-date" />
          <v-text-field v-model="dialog.form.departureTime" label="Departure time" type="time" data-testid="request-dep-time" />
          <v-text-field v-model="dialog.form.returnDate" label="Return date" type="date" data-testid="request-ret-date" />
          <v-text-field v-model="dialog.form.returnTime" label="Return time" type="time" data-testid="request-ret-time" />
          <v-text-field v-model.number="dialog.form.passengers" label="Passengers" type="number" min="1" max="15" data-testid="request-passengers" />
          <v-text-field v-model="dialog.form.purpose" label="Purpose" maxlength="500" data-testid="request-purpose" />
          <v-select
            v-model="dialog.form.noteType"
            label="Note type"
            :items="NOTE_TYPES"
            clearable
            data-testid="request-note-type"
          />
          <v-textarea v-model="dialog.form.noteText" label="Note text" maxlength="1000" data-testid="request-note-text" />
          <div class="d-flex justify-end mt-4">
            <v-btn color="secondary" variant="text" class="mr-2" :disabled="dialog.saving" data-testid="cancel-dialog" @click="cancelDialog">Cancel</v-btn>
            <v-btn type="submit" color="primary" variant="elevated" class="oc-cta" :loading="dialog.saving" :disabled="dialog.saving" data-testid="save-request">Save</v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="cancellation.open" max-width="420" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="cancel-request-dialog">
        <h2 class="text-h6 mb-2">Cancel request</h2>
        <p class="text-body-1 mb-4">Cancel this reservation request?</p>
        <v-alert v-if="cancellation.error" type="error" density="compact" class="mb-4" data-testid="cancel-request-error">{{ cancellation.error }}</v-alert>
        <div class="d-flex justify-end">
          <v-btn color="secondary" variant="text" class="mr-2" :disabled="cancellation.canceling" data-testid="keep-request" @click="keepCancel">Keep</v-btn>
          <v-btn color="error" variant="elevated" class="oc-cta" :loading="cancellation.canceling" :disabled="cancellation.canceling" data-testid="confirm-cancel-request" @click="confirmCancel">Cancel request</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <v-dialog v-model="statusDialog.open" max-width="480" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="status-dialog">
        <h2 class="text-h6 mb-4">Change status</h2>
        <v-alert v-if="statusDialog.error" type="error" density="compact" class="mb-4" data-testid="status-form-error">{{ statusDialog.error }}</v-alert>
        <v-select
          v-model="statusDialog.form.status"
          label="Status"
          :items="statusOptions"
          data-testid="status-select"
        />
        <v-select
          v-if="statusDialog.form.status === 'reserved'"
          v-model="statusDialog.form.vehicleId"
          label="Vehicle"
          :items="candidateVehicles"
          :item-title="(v) => `${v.make} ${v.model}`"
          item-value="id"
          :loading="loadingCandidates"
          data-testid="status-vehicle"
        />
        <v-textarea
          v-if="statusDialog.form.status === 'cancelled'"
          v-model="statusDialog.form.statusReason"
          label="Status reason"
          maxlength="500"
          data-testid="status-reason"
        />
        <div class="d-flex justify-end mt-4">
          <v-btn color="secondary" variant="text" class="mr-2" :disabled="statusDialog.saving" data-testid="cancel-status" @click="cancelStatusDialog">Cancel</v-btn>
          <v-btn color="primary" variant="elevated" class="oc-cta" :loading="statusDialog.saving" :disabled="statusDialog.saving" data-testid="save-status" @click="saveStatus">Save</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <v-dialog v-model="issueDialog.open" max-width="480" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="issue-dialog">
        <h2 class="text-h6 mb-4">Report issue</h2>
        <v-alert v-if="issueDialog.error" type="error" density="compact" class="mb-4" data-testid="issue-form-error">{{ issueDialog.error }}</v-alert>
        <v-form ref="issueFormRef" @submit.prevent="saveIssue">
          <v-select
            v-model="issueDialog.form.issueType"
            label="Issue type"
            :items="ISSUE_TYPES"
            data-testid="issue-type"
          />
          <v-select
            v-model="issueDialog.form.timing"
            label="When"
            :items="ISSUE_TIMINGS"
            data-testid="issue-timing"
          />
          <v-textarea
            v-model="issueDialog.form.note"
            label="Note"
            maxlength="1000"
            data-testid="issue-note"
          />
          <div class="d-flex justify-end mt-4">
            <v-btn color="secondary" variant="text" class="mr-2" :disabled="issueDialog.saving" data-testid="cancel-issue" @click="cancelIssueDialog">Cancel</v-btn>
            <v-btn type="submit" color="primary" variant="elevated" class="oc-cta" :loading="issueDialog.saving" :disabled="issueDialog.saving" data-testid="save-issue">Save</v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>
  </v-container>
</template>
