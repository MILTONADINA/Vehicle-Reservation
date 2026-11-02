<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import ReservationRequestServices from "../services/reservationRequestServices.js";
import AreaServices from "../services/areaServices.js";
import DriverServices from "../services/driverServices.js";
import DestinationServices from "../services/destinationServices.js";
import Utils from "../config/utils.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MILES_PATTERN = /^\d+(\.\d)?$/;
const NOTE_TYPES = ["general", "special_instructions", "other"];
const NOTE_TYPE_SET = new Set(NOTE_TYPES);

const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const isRequestor = computed(() => user.value?.role === "requestor");

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
    const [reqResult, areaResult, driverResult, destResult] = await Promise.all([
      ReservationRequestServices.getAll(),
      AreaServices.getAll(),
      DriverServices.getAll(),
      DestinationServices.getAll(),
    ]);
    requests.value = reqResult.data;
    areas.value = areaResult.data;
    drivers.value = driverResult.data;
    destinations.value = destResult.data;
    loaded.value = true;
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
</script>

<template>
  <v-container class="py-10">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Reservation requests</h1>
      <v-btn v-if="isRequestor" color="primary" variant="elevated" class="oc-cta" data-testid="add-request" @click="openAdd">Add request</v-btn>
    </div>

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
          <td>
            <v-btn v-if="isRequestor && req.requestorUserId === user?.userId && req.status === 'requested'" size="small" variant="text" color="primary" data-testid="edit-request" @click="openEdit(req)">Edit</v-btn>
            <v-btn v-if="isRequestor && req.requestorUserId === user?.userId && req.status === 'requested'" size="small" variant="text" color="error" data-testid="cancel-request" @click="openCancel(req)">Cancel</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

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
  </v-container>
</template>
