<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import AreaServices from "../services/areaServices.js";
import VehicleServices from "../services/vehicleServices.js";
import Utils from "../config/utils.js";

const LIMITS = { color: 40, plateNumber: 20, designatedParking: 200 };
const VIN_PATTERN = /^[A-Z0-9]{1,17}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const isAdmin = computed(() => user.value?.role === "admin");
const isAreaAdmin = computed(() => user.value?.role === "area_admin");
const canManage = computed(() => isAdmin.value || isAreaAdmin.value);

const vehicles = ref([]);
const areas = ref([]);
const makes = ref([]);
const modelsByMake = ref({});
const loading = ref(false);
const loaded = ref(false);
const loadError = ref("");

const areaName = (areaId) => areas.value.find((area) => area.id === areaId)?.areaName || `Area ${areaId}`;
const modelOptions = computed(() => modelsByMake.value[dialog.form.make] || []);
const areaOptions = computed(() => {
  if (isAreaAdmin.value) {
    return areas.value.filter((area) => area.id === user.value?.areaId);
  }
  return areas.value;
});

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const [vehicleResult, areaResult, optionsResult] = await Promise.all([
      VehicleServices.getAll(),
      AreaServices.getAll(),
      VehicleServices.getOptions(),
    ]);
    vehicles.value = vehicleResult.data;
    areas.value = areaResult.data;
    makes.value = optionsResult.data.makes;
    modelsByMake.value = optionsResult.data.modelsByMake;
    loaded.value = true;
  } catch (reason) {
    loadError.value = reason.response?.data?.message || "Vehicles could not be loaded.";
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
function validVehicleFields(form) {
  const make = typeof form.make === "string" ? form.make : null;
  const model = typeof form.model === "string" ? form.model : null;
  const allowedModels = make ? modelsByMake.value[make] : null;
  if (!make || !model || !allowedModels?.includes(model)) return null;

  const year = Number(form.year);
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(year) || year < 1980 || year > maxYear) return null;

  const vin = typeof form.vin === "string" ? form.vin.trim().toUpperCase() : null;
  if (!vin || !VIN_PATTERN.test(vin)) return null;
  if (!isCalendarDate(form.purchasedDate)) return null;

  const color = trimmedField(form.color, LIMITS.color);
  if (!color) return null;

  const passengers = Number(form.passengers);
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 15) return null;

  const plateNumber = trimmedField(form.plateNumber, LIMITS.plateNumber);
  if (!plateNumber) return null;

  const plateExpireMonth = Number(form.plateExpireMonth);
  if (!Number.isInteger(plateExpireMonth) || plateExpireMonth < 1 || plateExpireMonth > 12) return null;

  const designatedParking = trimmedField(form.designatedParking, LIMITS.designatedParking);
  if (!designatedParking) return null;

  const areaId = Number(form.areaId);
  if (!Number.isInteger(areaId) || areaId <= 0) return null;

  return {
    make,
    model,
    year,
    vin,
    purchasedDate: form.purchasedDate,
    color,
    passengers,
    plateNumber,
    plateExpireMonth,
    designatedParking,
    areaId,
  };
}

const required = (value) => (value !== null && value !== undefined && String(value).trim().length > 0) || "Invalid vehicle data.";
const rules = {
  make: [required],
  model: [required],
  year: [required, (value) => {
    const year = Number(value);
    const maxYear = new Date().getFullYear() + 1;
    return (Number.isInteger(year) && year >= 1980 && year <= maxYear) || "Invalid vehicle data.";
  }],
  vin: [required, (value) => VIN_PATTERN.test((value ?? "").trim().toUpperCase()) || "Invalid vehicle data."],
  purchasedDate: [required, (value) => isCalendarDate(value) || "Invalid vehicle data."],
  color: [required, (value) => (value ?? "").trim().length <= LIMITS.color || "Invalid vehicle data."],
  passengers: [required, (value) => {
    const passengers = Number(value);
    return (Number.isInteger(passengers) && passengers >= 1 && passengers <= 15) || "Invalid vehicle data.";
  }],
  plateNumber: [required, (value) => (value ?? "").trim().length <= LIMITS.plateNumber || "Invalid vehicle data."],
  plateExpireMonth: [required, (value) => {
    const month = Number(value);
    return (Number.isInteger(month) && month >= 1 && month <= 12) || "Invalid vehicle data.";
  }],
  designatedParking: [required, (value) => (value ?? "").trim().length <= LIMITS.designatedParking || "Invalid vehicle data."],
  areaId: [required],
};

const emptyForm = () => ({
  make: null,
  model: null,
  year: null,
  vin: "",
  purchasedDate: "",
  color: "",
  passengers: null,
  plateNumber: "",
  plateExpireMonth: null,
  designatedParking: "",
  areaId: isAreaAdmin.value ? user.value?.areaId ?? null : null,
});

const dialog = reactive({ open: false, editing: null, saving: false, error: "", form: emptyForm() });
const formRef = ref(null);

watch(() => dialog.form.make, (make) => {
  const allowed = modelsByMake.value[make] || [];
  if (dialog.form.model && !allowed.includes(dialog.form.model)) {
    dialog.form.model = null;
  }
});

async function openDialog(editing, form) {
  dialog.editing = editing;
  dialog.form = form;
  dialog.error = "";
  dialog.open = true;
  await nextTick();
  formRef.value?.resetValidation();
}
const openAdd = () => openDialog(null, emptyForm());
const openEdit = (vehicle) => openDialog(vehicle, {
  make: vehicle.make,
  model: vehicle.model,
  year: vehicle.year,
  vin: vehicle.vin,
  purchasedDate: vehicle.purchasedDate,
  color: vehicle.color,
  passengers: vehicle.passengers,
  plateNumber: vehicle.plateNumber,
  plateExpireMonth: vehicle.plateExpireMonth,
  designatedParking: vehicle.designatedParking,
  areaId: vehicle.areaId,
});
function cancelDialog() {
  formRef.value?.resetValidation();
  dialog.open = false;
  dialog.error = "";
  dialog.form = emptyForm();
}
async function save() {
  if (dialog.saving) return;
  const fields = validVehicleFields(dialog.form);
  if (!fields) {
    dialog.error = "Invalid vehicle data.";
    return;
  }
  dialog.saving = true;
  dialog.error = "";
  try {
    if (dialog.editing) {
      await VehicleServices.update(dialog.editing.id, fields);
    } else {
      await VehicleServices.create(fields);
    }
    dialog.open = false;
    dialog.form = emptyForm();
    await load();
  } catch (reason) {
    dialog.error = reason.response?.data?.message || "Vehicle could not be saved.";
  } finally {
    dialog.saving = false;
  }
}

const removal = reactive({ open: false, vehicle: null, deleting: false, error: "" });
function openDelete(vehicle) {
  removal.vehicle = vehicle;
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
    await VehicleServices.remove(removal.vehicle.id);
    removal.open = false;
    await load();
  } catch (reason) {
    removal.error = reason.response?.data?.message || "Vehicle could not be deleted.";
  } finally {
    removal.deleting = false;
  }
}
</script>

<template>
  <v-container class="py-10">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Vehicles</h1>
      <v-btn v-if="canManage" color="primary" variant="elevated" class="oc-cta" data-testid="add-vehicle" @click="openAdd">Add vehicle</v-btn>
    </div>

    <v-progress-circular v-if="loading" indeterminate color="primary" data-testid="vehicles-loading" />
    <v-alert v-else-if="loadError" type="error" density="compact" data-testid="vehicles-error">{{ loadError }}</v-alert>
    <p v-else-if="loaded && vehicles.length === 0" class="text-body-1" data-testid="vehicles-empty">No vehicles found.</p>

    <v-table v-if="!loading && !loadError && vehicles.length > 0">
      <thead>
        <tr>
          <th>Make</th>
          <th>Model</th>
          <th>Year</th>
          <th>Color</th>
          <th>Passengers</th>
          <th>Plate</th>
          <th>Plate expires</th>
          <th>Parking</th>
          <th>Area</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="vehicle in vehicles" :key="vehicle.id" data-testid="vehicle-row">
          <td>{{ vehicle.make }}</td>
          <td>{{ vehicle.model }}</td>
          <td>{{ vehicle.year }}</td>
          <td>{{ vehicle.color }}</td>
          <td>{{ vehicle.passengers }}</td>
          <td>{{ vehicle.plateNumber }}</td>
          <td>{{ vehicle.plateExpireMonth }}</td>
          <td>{{ vehicle.designatedParking }}</td>
          <td>{{ areaName(vehicle.areaId) }}</td>
          <td>
            <v-btn size="small" variant="text" color="primary" data-testid="edit-vehicle" @click="openEdit(vehicle)">Edit</v-btn>
            <v-btn size="small" variant="text" color="error" data-testid="delete-vehicle" @click="openDelete(vehicle)">Delete</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="dialog.open" max-width="640" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="vehicle-dialog">
        <h2 class="text-h6 mb-4">{{ dialog.editing ? "Edit vehicle" : "Add vehicle" }}</h2>
        <v-alert v-if="dialog.error" type="error" density="compact" class="mb-4" data-testid="vehicle-form-error">{{ dialog.error }}</v-alert>
        <v-form ref="formRef" @submit.prevent="save">
          <v-select v-model="dialog.form.make" label="Make" :items="makes" :rules="rules.make" data-testid="vehicle-make" />
          <v-select v-model="dialog.form.model" label="Model" :items="modelOptions" :rules="rules.model" :disabled="!dialog.form.make" data-testid="vehicle-model" />
          <v-text-field v-model.number="dialog.form.year" label="Year" type="number" :rules="rules.year" data-testid="vehicle-year" />
          <v-text-field v-model="dialog.form.vin" label="VIN" :rules="rules.vin" maxlength="17" data-testid="vehicle-vin" />
          <v-text-field v-model="dialog.form.purchasedDate" label="Purchased date" type="date" :rules="rules.purchasedDate" data-testid="vehicle-purchased-date" />
          <v-text-field v-model="dialog.form.color" label="Color" :rules="rules.color" :maxlength="LIMITS.color" data-testid="vehicle-color" />
          <v-text-field v-model.number="dialog.form.passengers" label="Passengers" type="number" :rules="rules.passengers" data-testid="vehicle-passengers" />
          <v-text-field v-model="dialog.form.plateNumber" label="Plate number" :rules="rules.plateNumber" :maxlength="LIMITS.plateNumber" data-testid="vehicle-plate-number" />
          <v-select v-model="dialog.form.plateExpireMonth" label="Plate expire month" :items="MONTHS" :rules="rules.plateExpireMonth" data-testid="vehicle-plate-expire-month" />
          <v-text-field v-model="dialog.form.designatedParking" label="Designated parking" :rules="rules.designatedParking" :maxlength="LIMITS.designatedParking" data-testid="vehicle-parking" />
          <v-select
            v-model="dialog.form.areaId"
            label="Area"
            :items="areaOptions"
            item-title="areaName"
            item-value="id"
            :rules="rules.areaId"
            :disabled="isAreaAdmin"
            data-testid="vehicle-area"
          />
          <div class="d-flex justify-end mt-4">
            <v-btn color="secondary" variant="text" class="mr-2" :disabled="dialog.saving" data-testid="cancel-vehicle" @click="cancelDialog">Cancel</v-btn>
            <v-btn type="submit" color="primary" variant="elevated" class="oc-cta" :loading="dialog.saving" :disabled="dialog.saving" data-testid="save-vehicle">Save</v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="removal.open" max-width="420" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="delete-dialog">
        <h2 class="text-h6 mb-2">Delete vehicle</h2>
        <p class="text-body-1 mb-4">Delete this vehicle?</p>
        <v-alert v-if="removal.error" type="error" density="compact" class="mb-4" data-testid="delete-error">{{ removal.error }}</v-alert>
        <div class="d-flex justify-end">
          <v-btn color="secondary" variant="text" class="mr-2" :disabled="removal.deleting" data-testid="cancel-delete" @click="cancelDelete">Cancel</v-btn>
          <v-btn color="error" variant="elevated" class="oc-cta" :loading="removal.deleting" :disabled="removal.deleting" data-testid="confirm-delete" @click="confirmDelete">Delete</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>
