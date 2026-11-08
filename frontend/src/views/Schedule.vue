<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import ScheduleServices from "../services/scheduleServices.js";
import AreaServices from "../services/areaServices.js";
import Utils from "../config/utils.js";

const router = useRouter();
const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const isAdmin = computed(() => user.value?.role === "admin");
const canSeeSchedule = computed(() => ["admin", "area_admin"].includes(user.value?.role));

function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return moved.toISOString().slice(0, 10);
}

function mondayOf(instant = new Date()) {
  const y = instant.getUTCFullYear();
  const m = instant.getUTCMonth();
  const d = instant.getUTCDate();
  const weekday = new Date(Date.UTC(y, m, d)).getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, offset);
}

const weekStart = ref(mondayOf());
const weekEnd = ref(addDays(weekStart.value, 6));
const areaId = ref(null);
const areas = ref([]);

const scheduleItems = ref([]);
const scheduleLoading = ref(false);
const scheduleLoaded = ref(false);
const scheduleError = ref("");

const needVehicle = ref([]);
const needCheckIn = ref([]);
const queueLoading = ref(false);
const queueLoaded = ref(false);
const queueError = ref("");

async function loadAreas() {
  if (!isAdmin.value) return;
  try {
    const { data } = await AreaServices.getAll();
    areas.value = data;
  } catch {
    areas.value = [];
  }
}

async function loadSchedule() {
  if (!canSeeSchedule.value) return;
  scheduleLoading.value = true;
  scheduleError.value = "";
  try {
    const params = { weekStart: weekStart.value };
    if (isAdmin.value && areaId.value) params.areaId = areaId.value;
    const { data } = await ScheduleServices.getSchedule(params);
    weekStart.value = data.weekStart;
    weekEnd.value = data.weekEnd;
    scheduleItems.value = data.items || [];
    scheduleLoaded.value = true;
  } catch (reason) {
    scheduleItems.value = [];
    scheduleError.value = reason.response?.data?.message || "Schedule could not be loaded.";
  } finally {
    scheduleLoading.value = false;
  }
}

async function loadQueue() {
  if (!canSeeSchedule.value) return;
  queueLoading.value = true;
  queueError.value = "";
  try {
    const params = {};
    if (isAdmin.value && areaId.value) params.areaId = areaId.value;
    const { data } = await ScheduleServices.getServiceQueue(params);
    needVehicle.value = data.needVehicle || [];
    needCheckIn.value = data.needCheckIn || [];
    queueLoaded.value = true;
  } catch (reason) {
    needVehicle.value = [];
    needCheckIn.value = [];
    queueError.value = reason.response?.data?.message || "Service queue could not be loaded.";
  } finally {
    queueLoading.value = false;
  }
}

async function loadAll() {
  await Promise.all([loadSchedule(), loadQueue()]);
}

function previousWeek() {
  weekStart.value = addDays(weekStart.value, -7);
  loadSchedule();
}

function nextWeek() {
  weekStart.value = addDays(weekStart.value, 7);
  loadSchedule();
}

function openRequest() {
  router.push({ name: "reservation-requests" });
}

function tripLabel(item) {
  const dep = item.departureTime ? `${item.departureDate} ${item.departureTime}` : item.departureDate;
  const ret = item.returnTime ? `${item.returnDate} ${item.returnTime}` : item.returnDate;
  return `${dep} → ${ret}`;
}

watch(areaId, () => {
  loadAll();
});

onMounted(async () => {
  await loadAreas();
  await loadAll();
});
</script>

<template>
  <v-container class="py-10">
    <h1 class="text-h4 mb-6">Schedule</h1>

    <section class="mb-10" data-testid="schedule-section">
      <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-4">
        <h2 class="text-h5">This week</h2>
        <div class="d-flex align-center ga-2">
          <v-select
            v-if="isAdmin"
            v-model="areaId"
            label="Area"
            :items="areas"
            item-title="areaName"
            item-value="id"
            clearable
            density="compact"
            hide-details
            style="min-width: 200px"
            data-testid="schedule-area-filter"
          />
          <v-btn variant="outlined" data-testid="previous-week" @click="previousWeek">Previous week</v-btn>
          <span class="text-body-1" data-testid="week-range">{{ weekStart }} – {{ weekEnd }}</span>
          <v-btn variant="outlined" data-testid="next-week" @click="nextWeek">Next week</v-btn>
        </div>
      </div>

      <v-progress-circular v-if="scheduleLoading" indeterminate color="primary" data-testid="schedule-loading" />
      <v-alert v-else-if="scheduleError" type="error" density="compact" data-testid="schedule-error">{{ scheduleError }}</v-alert>
      <p v-else-if="scheduleLoaded && scheduleItems.length === 0" class="text-body-1" data-testid="schedule-empty">No reservations this week.</p>

      <v-table v-if="!scheduleLoading && !scheduleError && scheduleItems.length > 0" data-testid="schedule-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Status</th>
            <th>Trip</th>
            <th>Vehicle</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in scheduleItems"
            :key="item.id"
            data-testid="schedule-row"
            style="cursor: pointer"
            @click="openRequest"
          >
            <td>{{ item.requestorName || `#${item.id}` }}</td>
            <td data-testid="schedule-status">{{ item.status }}</td>
            <td data-testid="schedule-times">{{ tripLabel(item) }}</td>
            <td data-testid="schedule-vehicle">{{ item.vehicleLabel || "No vehicle" }}</td>
          </tr>
        </tbody>
      </v-table>
    </section>

    <section data-testid="service-queue-section">
      <h2 class="text-h5 mb-4">Service queue</h2>

      <v-progress-circular v-if="queueLoading" indeterminate color="primary" data-testid="queue-loading" />
      <v-alert v-else-if="queueError" type="error" density="compact" data-testid="queue-error">{{ queueError }}</v-alert>

      <template v-else-if="queueLoaded">
        <h3 class="text-h6 mb-2">Need vehicle</h3>
        <p v-if="needVehicle.length === 0" class="text-body-1 mb-4" data-testid="need-vehicle-empty">No requests need a vehicle.</p>
        <v-table v-else class="mb-6" data-testid="need-vehicle-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Status</th>
              <th>Trip</th>
              <th>Vehicle</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in needVehicle" :key="`nv-${item.id}`" data-testid="need-vehicle-row" @click="openRequest">
              <td>{{ item.requestorName || `#${item.id}` }}</td>
              <td>{{ item.status }}</td>
              <td>{{ tripLabel(item) }}</td>
              <td>{{ item.vehicleLabel || "No vehicle" }}</td>
            </tr>
          </tbody>
        </v-table>

        <h3 class="text-h6 mb-2">Need check-in</h3>
        <p v-if="needCheckIn.length === 0" class="text-body-1" data-testid="need-checkin-empty">No requests need check-in.</p>
        <v-table v-else data-testid="need-checkin-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Status</th>
              <th>Trip</th>
              <th>Vehicle</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in needCheckIn" :key="`nc-${item.id}`" data-testid="need-checkin-row" @click="openRequest">
              <td>{{ item.requestorName || `#${item.id}` }}</td>
              <td>{{ item.status }}</td>
              <td>{{ tripLabel(item) }}</td>
              <td>{{ item.vehicleLabel || "No vehicle" }}</td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </section>
  </v-container>
</template>
