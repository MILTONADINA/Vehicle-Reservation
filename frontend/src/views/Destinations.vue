<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import DestinationServices from "../services/destinationServices.js";
import Utils from "../config/utils.js";

const LIMITS = { destinationName: 100, addressLine: 200, city: 100 };
const ZIP_PATTERN = /^\d{5}$/;
const MILES_PATTERN = /^\d+(\.\d)?$/;
const STATUSES = ["active", "inactive"];

const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const canManage = computed(() => ["admin", "area_admin"].includes(user.value?.role));

const destinations = ref([]);
const states = ref([]);
const loading = ref(false);
const loaded = ref(false);
const loadError = ref("");

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [destinationResult, optionsResult] = await Promise.all([
      DestinationServices.getAll(),
      DestinationServices.getOptions(),
    ]);
    destinations.value = destinationResult.data;
    states.value = optionsResult.data.states;
    loaded.value = true;
  } catch (reason) {
    loadError.value = reason.response?.data?.message || "Destinations could not be loaded.";
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const trimmedField = (value, limit) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= limit ? text : null;
};

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

function validDestinationFields(form) {
  const destinationName = trimmedField(form.destinationName, LIMITS.destinationName);
  const addressLine = trimmedField(form.addressLine, LIMITS.addressLine);
  const city = trimmedField(form.city, LIMITS.city);
  if (!destinationName || !addressLine || !city) return null;

  const state = typeof form.state === "string" ? form.state.trim().toUpperCase() : null;
  if (!state || !states.value.includes(state)) return null;

  const zipCode = typeof form.zipCode === "string" ? form.zipCode.trim() : null;
  if (!zipCode || !ZIP_PATTERN.test(zipCode)) return null;

  const roundTripMiles = parseMiles(form.roundTripMiles);
  if (roundTripMiles === null) return null;
  if (!STATUSES.includes(form.status)) return null;

  return { destinationName, addressLine, city, state, zipCode, roundTripMiles, status: form.status };
}

const INVALID = "Invalid destination data.";
const required = (value) => (value !== null && value !== undefined && String(value).trim().length > 0) || INVALID;
const rules = {
  destinationName: [required, (value) => (value ?? "").trim().length <= LIMITS.destinationName || INVALID],
  addressLine: [required, (value) => (value ?? "").trim().length <= LIMITS.addressLine || INVALID],
  city: [required, (value) => (value ?? "").trim().length <= LIMITS.city || INVALID],
  state: [(value) => states.value.includes(value) || INVALID],
  zipCode: [required, (value) => ZIP_PATTERN.test((value ?? "").trim()) || INVALID],
  roundTripMiles: [(value) => parseMiles(value) !== null || INVALID],
  status: [(value) => STATUSES.includes(value) || INVALID],
};

const emptyForm = () => ({
  destinationName: "",
  addressLine: "",
  city: "",
  state: null,
  zipCode: "",
  roundTripMiles: "",
  status: null,
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
const openEdit = (destination) => openDialog(destination, {
  destinationName: destination.destinationName,
  addressLine: destination.addressLine,
  city: destination.city,
  state: destination.state,
  zipCode: destination.zipCode,
  roundTripMiles: String(destination.roundTripMiles),
  status: destination.status,
});
function cancelDialog() {
  formRef.value?.resetValidation();
  dialog.open = false;
  dialog.error = "";
  dialog.form = emptyForm();
}
async function save() {
  if (dialog.saving) return;
  const fields = validDestinationFields(dialog.form);
  if (!fields) {
    dialog.error = INVALID;
    return;
  }
  dialog.saving = true;
  dialog.error = "";
  try {
    if (dialog.editing) {
      await DestinationServices.update(dialog.editing.id, fields);
    } else {
      await DestinationServices.create(fields);
    }
    dialog.open = false;
    dialog.form = emptyForm();
    await load();
  } catch (reason) {
    dialog.error = reason.response?.data?.message || "Destination could not be saved.";
  } finally {
    dialog.saving = false;
  }
}

const removal = reactive({ open: false, destination: null, deleting: false, error: "" });
function openDelete(destination) {
  removal.destination = destination;
  removal.error = "";
  removal.open = true;
}
function cancelDelete() {
  removal.open = false;
  removal.error = "";
}
async function confirmDelete() {
  if (removal.deleting) return;
  removal.deleting = true;
  removal.error = "";
  try {
    await DestinationServices.remove(removal.destination.id);
    removal.open = false;
    await load();
  } catch (reason) {
    removal.error = reason.response?.data?.message || "Destination could not be deleted.";
  } finally {
    removal.deleting = false;
  }
}
</script>

<template>
  <v-container class="py-10">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Destinations</h1>
      <v-btn v-if="canManage" color="primary" variant="elevated" class="oc-cta" data-testid="add-destination" @click="openAdd">Add destination</v-btn>
    </div>

    <v-progress-circular v-if="loading" indeterminate color="primary" data-testid="destinations-loading" />
    <v-alert v-else-if="loadError" type="error" density="compact" data-testid="destinations-error">{{ loadError }}</v-alert>
    <p v-else-if="loaded && destinations.length === 0" class="text-body-1" data-testid="destinations-empty">No destinations found.</p>

    <v-table v-if="!loading && !loadError && destinations.length > 0">
      <thead>
        <tr>
          <th>Name</th>
          <th>Address</th>
          <th>City</th>
          <th>State</th>
          <th>Zip</th>
          <th>Round-trip miles</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="destination in destinations" :key="destination.id" data-testid="destination-row">
          <td>{{ destination.destinationName }}</td>
          <td>{{ destination.addressLine }}</td>
          <td>{{ destination.city }}</td>
          <td>{{ destination.state }}</td>
          <td>{{ destination.zipCode }}</td>
          <td>{{ destination.roundTripMiles }}</td>
          <td>{{ destination.status }}</td>
          <td>
            <v-btn v-if="canManage" size="small" variant="text" color="primary" data-testid="edit-destination" @click="openEdit(destination)">Edit</v-btn>
            <v-btn v-if="canManage" size="small" variant="text" color="error" data-testid="delete-destination" @click="openDelete(destination)">Delete</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="dialog.open" max-width="560" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="destination-dialog">
        <h2 class="text-h6 mb-4">{{ dialog.editing ? "Edit destination" : "Add destination" }}</h2>
        <v-alert v-if="dialog.error" type="error" density="compact" class="mb-4" data-testid="destination-form-error">{{ dialog.error }}</v-alert>
        <v-form ref="formRef" @submit.prevent="save">
          <v-text-field v-model="dialog.form.destinationName" label="Name" :rules="rules.destinationName" :maxlength="LIMITS.destinationName" data-testid="destination-name" />
          <v-text-field v-model="dialog.form.addressLine" label="Address" :rules="rules.addressLine" :maxlength="LIMITS.addressLine" data-testid="destination-address" />
          <v-text-field v-model="dialog.form.city" label="City" :rules="rules.city" :maxlength="LIMITS.city" data-testid="destination-city" />
          <v-select
            v-model="dialog.form.state"
            label="State"
            :items="states"
            :rules="rules.state"
            data-testid="destination-state"
          />
          <v-text-field v-model="dialog.form.zipCode" label="Zip" :rules="rules.zipCode" maxlength="5" data-testid="destination-zip" />
          <v-text-field
            v-model="dialog.form.roundTripMiles"
            label="Round-trip miles"
            type="number"
            step="0.1"
            min="0.1"
            max="9999.9"
            :rules="rules.roundTripMiles"
            data-testid="destination-miles"
          />
          <v-select
            v-model="dialog.form.status"
            label="Status"
            :items="STATUSES"
            :rules="rules.status"
            data-testid="destination-status"
          />
          <div class="d-flex justify-end mt-4">
            <v-btn color="secondary" variant="text" class="mr-2" :disabled="dialog.saving" data-testid="cancel-destination" @click="cancelDialog">Cancel</v-btn>
            <v-btn type="submit" color="primary" variant="elevated" class="oc-cta" :loading="dialog.saving" :disabled="dialog.saving" data-testid="save-destination">Save</v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="removal.open" max-width="420" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="delete-destination-dialog">
        <h2 class="text-h6 mb-2">Delete destination</h2>
        <p class="text-body-1 mb-4">Delete this destination?</p>
        <v-alert v-if="removal.error" type="error" density="compact" class="mb-4" data-testid="delete-destination-error">{{ removal.error }}</v-alert>
        <div class="d-flex justify-end">
          <v-btn color="secondary" variant="text" class="mr-2" :disabled="removal.deleting" data-testid="cancel-delete-destination" @click="cancelDelete">Cancel</v-btn>
          <v-btn color="error" variant="elevated" class="oc-cta" :loading="removal.deleting" :disabled="removal.deleting" data-testid="confirm-delete-destination" @click="confirmDelete">Delete</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>
