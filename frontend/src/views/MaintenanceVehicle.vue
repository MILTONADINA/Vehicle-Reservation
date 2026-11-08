<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import MaintenanceLogServices from "../services/maintenanceLogServices.js";
import Utils from "../config/utils.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SERVICE_TYPES = [
  { title: "Repair", value: "repair" },
  { title: "Oil change", value: "oil_change" },
  { title: "Tire replacement", value: "tire_replacement" },
];
const SERVICE_LABELS = {
  repair: "Repair",
  oil_change: "Oil change",
  tire_replacement: "Tire replacement",
};

const route = useRoute();
const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const canSeeMaintenance = computed(() => ["admin", "maintenance"].includes(user.value?.role));
const vehicleId = computed(() => route.params.vehicleId);

const vehicle = ref(null);
const mileageLogs = ref([]);
const serviceLogs = ref([]);

const mileageLoading = ref(false);
const mileageLoaded = ref(false);
const mileageError = ref("");
const serviceLoading = ref(false);
const serviceLoaded = ref(false);
const serviceError = ref("");
const vehicleError = ref("");

const isCalendarDate = (value) => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

async function loadVehicleSummary() {
  vehicleError.value = "";
  try {
    const { data } = await MaintenanceLogServices.listVehicles();
    vehicle.value = data.find((row) => String(row.id) === String(vehicleId.value)) || null;
    if (!vehicle.value) vehicleError.value = "Vehicle could not be loaded.";
  } catch (reason) {
    vehicleError.value = reason.response?.data?.message || "Vehicle could not be loaded.";
  }
}

async function loadMileage() {
  mileageLoading.value = true;
  mileageError.value = "";
  try {
    const { data } = await MaintenanceLogServices.listMileage(vehicleId.value);
    mileageLogs.value = data;
    mileageLoaded.value = true;
  } catch (reason) {
    mileageError.value = reason.response?.data?.message || "Mileage could not be loaded.";
  } finally {
    mileageLoading.value = false;
  }
}

async function loadServices() {
  serviceLoading.value = true;
  serviceError.value = "";
  try {
    const { data } = await MaintenanceLogServices.listService(vehicleId.value);
    serviceLogs.value = data;
    serviceLoaded.value = true;
  } catch (reason) {
    serviceError.value = reason.response?.data?.message || "Service logs could not be loaded.";
  } finally {
    serviceLoading.value = false;
  }
}

async function loadAll() {
  if (!canSeeMaintenance.value) return;
  await loadVehicleSummary();
  await Promise.all([loadMileage(), loadServices()]);
}
onMounted(loadAll);
watch(vehicleId, loadAll);

const heading = computed(() => {
  if (!vehicle.value) return "Vehicle logs";
  return `${vehicle.value.make} ${vehicle.value.model} · ${vehicle.value.plateNumber}`;
});

function serviceLabel(type) {
  return SERVICE_LABELS[type] || type;
}

const emptyMileageForm = () => ({ logDate: "", mileage: "" });
const emptyServiceForm = () => ({ serviceDate: "", serviceType: null, note: "" });

const mileageDialog = reactive({ open: false, saving: false, error: "", form: emptyMileageForm() });
const serviceDialog = reactive({ open: false, saving: false, error: "", form: emptyServiceForm() });
const mileageFormRef = ref(null);
const serviceFormRef = ref(null);

const required = (value) => (value !== null && value !== undefined && String(value).trim().length > 0) || "Required.";
const mileageRules = {
  logDate: [required, (value) => isCalendarDate(value) || "Invalid date."],
  mileage: [
    required,
    (value) => {
      const mileage = Number(value);
      return (Number.isInteger(mileage) && mileage >= 0 && mileage <= 2_000_000) || "Invalid mileage.";
    },
  ],
};
const serviceRules = {
  serviceDate: [required, (value) => isCalendarDate(value) || "Invalid date."],
  serviceType: [required],
  note: [(value) => !value || String(value).trim().length <= 1000 || "Note is too long."],
};

async function openMileageDialog() {
  mileageDialog.form = emptyMileageForm();
  mileageDialog.error = "";
  mileageDialog.open = true;
  await nextTick();
  mileageFormRef.value?.resetValidation();
}

async function openServiceDialog() {
  serviceDialog.form = emptyServiceForm();
  serviceDialog.error = "";
  serviceDialog.open = true;
  await nextTick();
  serviceFormRef.value?.resetValidation();
}

async function saveMileage() {
  const { valid } = await mileageFormRef.value.validate();
  if (!valid || mileageDialog.saving) return;
  const mileage = Number(mileageDialog.form.mileage);
  if (!isCalendarDate(mileageDialog.form.logDate) || !Number.isInteger(mileage)) return;

  mileageDialog.saving = true;
  mileageDialog.error = "";
  try {
    await MaintenanceLogServices.createMileage(vehicleId.value, {
      logDate: mileageDialog.form.logDate,
      mileage,
    });
    mileageDialog.open = false;
    await loadMileage();
  } catch (reason) {
    mileageDialog.error = reason.response?.data?.message || "Mileage could not be saved.";
  } finally {
    mileageDialog.saving = false;
  }
}

async function saveService() {
  const { valid } = await serviceFormRef.value.validate();
  if (!valid || serviceDialog.saving) return;
  if (!isCalendarDate(serviceDialog.form.serviceDate) || !serviceDialog.form.serviceType) return;

  serviceDialog.saving = true;
  serviceDialog.error = "";
  const payload = {
    serviceDate: serviceDialog.form.serviceDate,
    serviceType: serviceDialog.form.serviceType,
  };
  if (serviceDialog.form.note != null && String(serviceDialog.form.note).length > 0) {
    payload.note = serviceDialog.form.note;
  }
  try {
    await MaintenanceLogServices.createService(vehicleId.value, payload);
    serviceDialog.open = false;
    await loadServices();
  } catch (reason) {
    serviceDialog.error = reason.response?.data?.message || "Service log could not be saved.";
  } finally {
    serviceDialog.saving = false;
  }
}
</script>

<template>
  <v-container class="py-10">
    <v-btn :to="{ name: 'maintenance' }" variant="text" class="mb-2" data-testid="back-to-maintenance">Back to Maintenance</v-btn>
    <h1 class="text-h4 mb-4" data-testid="maintenance-vehicle-heading">{{ heading }}</h1>
    <v-alert v-if="vehicleError" type="error" density="compact" class="mb-4" data-testid="maintenance-vehicle-error">{{ vehicleError }}</v-alert>

    <section class="mb-8">
      <div class="d-flex align-center justify-space-between mb-3">
        <h2 class="text-h5">Mileage</h2>
        <v-btn color="primary" data-testid="add-mileage" @click="openMileageDialog">Add mileage</v-btn>
      </div>
      <v-progress-circular v-if="mileageLoading" indeterminate color="primary" data-testid="mileage-loading" />
      <v-alert v-else-if="mileageError" type="error" density="compact" data-testid="mileage-error">{{ mileageError }}</v-alert>
      <p v-else-if="mileageLoaded && mileageLogs.length === 0" class="text-body-1" data-testid="mileage-empty">No mileage logs found.</p>
      <v-table v-if="!mileageLoading && !mileageError && mileageLogs.length > 0" data-testid="mileage-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Mileage</th>
            <th>Logged by</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in mileageLogs" :key="row.id" data-testid="mileage-row">
            <td data-testid="mileage-date">{{ row.logDate }}</td>
            <td data-testid="mileage-value">{{ row.mileage }}</td>
            <td data-testid="mileage-logger">{{ row.loggedByUserId }}</td>
          </tr>
        </tbody>
      </v-table>
    </section>

    <section>
      <div class="d-flex align-center justify-space-between mb-3">
        <h2 class="text-h5">Services</h2>
        <v-btn color="primary" data-testid="add-service" @click="openServiceDialog">Add service</v-btn>
      </div>
      <v-progress-circular v-if="serviceLoading" indeterminate color="primary" data-testid="service-loading" />
      <v-alert v-else-if="serviceError" type="error" density="compact" data-testid="service-error">{{ serviceError }}</v-alert>
      <p v-else-if="serviceLoaded && serviceLogs.length === 0" class="text-body-1" data-testid="service-empty">No service logs found.</p>
      <v-table v-if="!serviceLoading && !serviceError && serviceLogs.length > 0" data-testid="service-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in serviceLogs" :key="row.id" data-testid="service-row">
            <td data-testid="service-date">{{ row.serviceDate }}</td>
            <td data-testid="service-type">{{ serviceLabel(row.serviceType) }}</td>
            <td data-testid="service-note">{{ row.note || "" }}</td>
          </tr>
        </tbody>
      </v-table>
    </section>

    <v-dialog v-model="mileageDialog.open" max-width="480" persistent>
      <v-card data-testid="mileage-dialog">
        <v-card-title>Add mileage</v-card-title>
        <v-card-text>
          <v-form ref="mileageFormRef">
            <v-text-field
              v-model="mileageDialog.form.logDate"
              label="Date"
              type="date"
              :rules="mileageRules.logDate"
              data-testid="mileage-date-input"
            />
            <v-text-field
              v-model="mileageDialog.form.mileage"
              label="Mileage"
              type="number"
              :rules="mileageRules.mileage"
              data-testid="mileage-value-input"
            />
          </v-form>
          <v-alert v-if="mileageDialog.error" type="error" density="compact" class="mt-2" data-testid="mileage-save-error">
            {{ mileageDialog.error }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" data-testid="mileage-cancel" :disabled="mileageDialog.saving" @click="mileageDialog.open = false">Cancel</v-btn>
          <v-btn color="primary" data-testid="mileage-save" :loading="mileageDialog.saving" :disabled="mileageDialog.saving" @click="saveMileage">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="serviceDialog.open" max-width="520" persistent>
      <v-card data-testid="service-dialog">
        <v-card-title>Add service</v-card-title>
        <v-card-text>
          <v-form ref="serviceFormRef">
            <v-text-field
              v-model="serviceDialog.form.serviceDate"
              label="Date"
              type="date"
              :rules="serviceRules.serviceDate"
              data-testid="service-date-input"
            />
            <v-select
              v-model="serviceDialog.form.serviceType"
              label="Service type"
              :items="SERVICE_TYPES"
              :rules="serviceRules.serviceType"
              data-testid="service-type-input"
            />
            <v-textarea
              v-model="serviceDialog.form.note"
              label="Note"
              :rules="serviceRules.note"
              data-testid="service-note-input"
            />
          </v-form>
          <v-alert v-if="serviceDialog.error" type="error" density="compact" class="mt-2" data-testid="service-save-error">
            {{ serviceDialog.error }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" data-testid="service-cancel" :disabled="serviceDialog.saving" @click="serviceDialog.open = false">Cancel</v-btn>
          <v-btn color="primary" data-testid="service-save" :loading="serviceDialog.saving" :disabled="serviceDialog.saving" @click="saveService">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
