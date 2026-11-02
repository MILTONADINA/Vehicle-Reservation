<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import DriverServices from "../services/driverServices.js";
import Utils from "../config/utils.js";

const LIMITS = { name: 100 };
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["approved", "inactive"];

const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const canManage = computed(() => ["admin", "area_admin"].includes(user.value?.role));

const drivers = ref([]);
const licenseStates = ref([]);
const loading = ref(false);
const loaded = ref(false);
const loadError = ref("");

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [driverResult, optionsResult] = await Promise.all([
      DriverServices.getAll(),
      DriverServices.getOptions(),
    ]);
    drivers.value = driverResult.data;
    licenseStates.value = optionsResult.data.licenseStates;
    loaded.value = true;
  } catch (reason) {
    loadError.value = reason.response?.data?.message || "Drivers could not be loaded.";
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
const isCalendarDate = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
function validDriverFields(form) {
  const firstName = trimmedField(form.firstName, LIMITS.name);
  const lastName = trimmedField(form.lastName, LIMITS.name);
  if (!firstName || !lastName) return null;

  const licenseState = typeof form.licenseState === "string" ? form.licenseState.trim().toUpperCase() : null;
  if (!licenseState || !licenseStates.value.includes(licenseState)) return null;
  if (!isCalendarDate(form.licenseExpireDate) || !isCalendarDate(form.approvedDate)) return null;
  if (!STATUSES.includes(form.status)) return null;

  return {
    firstName,
    lastName,
    licenseState,
    licenseExpireDate: form.licenseExpireDate,
    approvedDate: form.approvedDate,
    status: form.status,
  };
}

const INVALID = "Invalid driver data.";
const required = (value) => (value !== null && value !== undefined && String(value).trim().length > 0) || INVALID;
const rules = {
  firstName: [required, (value) => (value ?? "").trim().length <= LIMITS.name || INVALID],
  lastName: [required, (value) => (value ?? "").trim().length <= LIMITS.name || INVALID],
  licenseState: [(value) => licenseStates.value.includes(value) || INVALID],
  licenseExpireDate: [required, (value) => isCalendarDate(value) || INVALID],
  approvedDate: [required, (value) => isCalendarDate(value) || INVALID],
  status: [(value) => STATUSES.includes(value) || INVALID],
};

const emptyForm = () => ({
  firstName: "",
  lastName: "",
  licenseState: null,
  licenseExpireDate: "",
  approvedDate: "",
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
const openEdit = (driver) => openDialog(driver, {
  firstName: driver.firstName,
  lastName: driver.lastName,
  licenseState: driver.licenseState,
  licenseExpireDate: driver.licenseExpireDate,
  approvedDate: driver.approvedDate,
  status: driver.status,
});
function cancelDialog() {
  formRef.value?.resetValidation();
  dialog.open = false;
  dialog.error = "";
  dialog.form = emptyForm();
}
async function save() {
  if (dialog.saving) return;
  const fields = validDriverFields(dialog.form);
  if (!fields) {
    dialog.error = INVALID;
    return;
  }
  dialog.saving = true;
  dialog.error = "";
  try {
    if (dialog.editing) {
      await DriverServices.update(dialog.editing.id, fields);
    } else {
      await DriverServices.create(fields);
    }
    dialog.open = false;
    dialog.form = emptyForm();
    await load();
  } catch (reason) {
    dialog.error = reason.response?.data?.message || "Driver could not be saved.";
  } finally {
    dialog.saving = false;
  }
}

const removal = reactive({ open: false, driver: null, deleting: false, error: "" });
function openDelete(driver) {
  removal.driver = driver;
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
    await DriverServices.remove(removal.driver.id);
    removal.open = false;
    await load();
  } catch (reason) {
    removal.error = reason.response?.data?.message || "Driver could not be deleted.";
  } finally {
    removal.deleting = false;
  }
}
</script>

<template>
  <v-container class="py-10">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Drivers</h1>
      <v-btn v-if="canManage" color="primary" variant="elevated" class="oc-cta" data-testid="add-driver" @click="openAdd">Add driver</v-btn>
    </div>

    <v-progress-circular v-if="loading" indeterminate color="primary" data-testid="drivers-loading" />
    <v-alert v-else-if="loadError" type="error" density="compact" data-testid="drivers-error">{{ loadError }}</v-alert>
    <p v-else-if="loaded && drivers.length === 0" class="text-body-1" data-testid="drivers-empty">No drivers found.</p>

    <v-table v-if="!loading && !loadError && drivers.length > 0">
      <thead>
        <tr>
          <th>First name</th>
          <th>Last name</th>
          <th>License state</th>
          <th>License expires</th>
          <th>Approved</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="driver in drivers" :key="driver.id" data-testid="driver-row">
          <td>{{ driver.firstName }}</td>
          <td>{{ driver.lastName }}</td>
          <td>{{ driver.licenseState }}</td>
          <td>{{ driver.licenseExpireDate }}</td>
          <td>{{ driver.approvedDate }}</td>
          <td>{{ driver.status }}</td>
          <td>
            <v-btn v-if="canManage" size="small" variant="text" color="primary" data-testid="edit-driver" @click="openEdit(driver)">Edit</v-btn>
            <v-btn v-if="canManage" size="small" variant="text" color="error" data-testid="delete-driver" @click="openDelete(driver)">Delete</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="dialog.open" max-width="560" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="driver-dialog">
        <h2 class="text-h6 mb-4">{{ dialog.editing ? "Edit driver" : "Add driver" }}</h2>
        <v-alert v-if="dialog.error" type="error" density="compact" class="mb-4" data-testid="driver-form-error">{{ dialog.error }}</v-alert>
        <v-form ref="formRef" @submit.prevent="save">
          <v-text-field v-model="dialog.form.firstName" label="First name" :rules="rules.firstName" :maxlength="LIMITS.name" data-testid="driver-first" />
          <v-text-field v-model="dialog.form.lastName" label="Last name" :rules="rules.lastName" :maxlength="LIMITS.name" data-testid="driver-last" />
          <v-select
            v-model="dialog.form.licenseState"
            label="License state"
            :items="licenseStates"
            :rules="rules.licenseState"
            data-testid="driver-license-state"
          />
          <v-text-field
            v-model="dialog.form.licenseExpireDate"
            label="License expire date"
            type="date"
            :rules="rules.licenseExpireDate"
            data-testid="driver-license-expire"
          />
          <v-text-field
            v-model="dialog.form.approvedDate"
            label="Approved date"
            type="date"
            :rules="rules.approvedDate"
            data-testid="driver-approved"
          />
          <v-select
            v-model="dialog.form.status"
            label="Status"
            :items="STATUSES"
            :rules="rules.status"
            data-testid="driver-status"
          />
          <div class="d-flex justify-end mt-4">
            <v-btn color="secondary" variant="text" class="mr-2" :disabled="dialog.saving" data-testid="cancel-driver" @click="cancelDialog">Cancel</v-btn>
            <v-btn type="submit" color="primary" variant="elevated" class="oc-cta" :loading="dialog.saving" :disabled="dialog.saving" data-testid="save-driver">Save</v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="removal.open" max-width="420" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="delete-driver-dialog">
        <h2 class="text-h6 mb-2">Delete driver</h2>
        <p class="text-body-1 mb-4">Delete this driver?</p>
        <v-alert v-if="removal.error" type="error" density="compact" class="mb-4" data-testid="delete-driver-error">{{ removal.error }}</v-alert>
        <div class="d-flex justify-end">
          <v-btn color="secondary" variant="text" class="mr-2" :disabled="removal.deleting" data-testid="cancel-delete-driver" @click="cancelDelete">Cancel</v-btn>
          <v-btn color="error" variant="elevated" class="oc-cta" :loading="removal.deleting" :disabled="removal.deleting" data-testid="confirm-delete-driver" @click="confirmDelete">Delete</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>
