<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import MaintenanceLogServices from "../services/maintenanceLogServices.js";
import Utils from "../config/utils.js";

const router = useRouter();
const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const canSeeMaintenance = computed(() => ["admin", "maintenance"].includes(user.value?.role));

const vehicles = ref([]);
const loading = ref(false);
const loaded = ref(false);
const loadError = ref("");

async function load() {
  if (!canSeeMaintenance.value) return;
  loading.value = true;
  loadError.value = "";
  try {
    const { data } = await MaintenanceLogServices.listVehicles();
    vehicles.value = data;
    loaded.value = true;
  } catch (reason) {
    loadError.value = reason.response?.data?.message || "Vehicles could not be loaded.";
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function openVehicle(vehicle) {
  router.push({ name: "maintenance-vehicle", params: { vehicleId: String(vehicle.id) } });
}
</script>

<template>
  <v-container class="py-10">
    <h1 class="text-h4 mb-2">Maintenance</h1>
    <p class="text-body-2 mb-4">
      For maintenance-need issue reports, open
      <router-link :to="{ name: 'issues' }" data-testid="maintenance-issues-link">Issues</router-link>.
    </p>

    <v-progress-circular v-if="loading" indeterminate color="primary" data-testid="maintenance-vehicles-loading" />
    <v-alert v-else-if="loadError" type="error" density="compact" data-testid="maintenance-vehicles-error">{{ loadError }}</v-alert>
    <p v-else-if="loaded && vehicles.length === 0" class="text-body-1" data-testid="maintenance-vehicles-empty">No vehicles found.</p>

    <v-table v-if="!loading && !loadError && vehicles.length > 0" data-testid="maintenance-vehicles-table">
      <thead>
        <tr>
          <th>Make</th>
          <th>Model</th>
          <th>Year</th>
          <th>Plate</th>
          <th>Color</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="vehicle in vehicles"
          :key="vehicle.id"
          data-testid="maintenance-vehicle-row"
          class="cursor-pointer"
          @click="openVehicle(vehicle)"
        >
          <td data-testid="vehicle-make">{{ vehicle.make }}</td>
          <td data-testid="vehicle-model">{{ vehicle.model }}</td>
          <td data-testid="vehicle-year">{{ vehicle.year }}</td>
          <td data-testid="vehicle-plate">{{ vehicle.plateNumber }}</td>
          <td>{{ vehicle.color }}</td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>
