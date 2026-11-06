<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import IssueServices from "../services/issueServices.js";
import Utils from "../config/utils.js";

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

const canSeeIssues = computed(() => ["admin", "area_admin", "maintenance"].includes(user.value?.role));

const issues = ref([]);
const loading = ref(false);
const loaded = ref(false);
const loadError = ref("");

async function load() {
  if (!canSeeIssues.value) return;
  loading.value = true;
  loadError.value = "";
  try {
    const { data } = await IssueServices.listOpen();
    issues.value = data;
    loaded.value = true;
  } catch (reason) {
    loadError.value = reason.response?.data?.message || "Issues could not be loaded.";
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function typeLabel(issue) {
  return ISSUE_TYPE_LABELS[issue.issueType] || issue.issueType;
}
function timingLabel(issue) {
  return TIMING_LABELS[issue.timing] || issue.timing;
}
function createdLabel(issue) {
  if (!issue.createdAt) return "";
  return new Date(issue.createdAt).toLocaleString();
}
</script>

<template>
  <v-container class="py-10">
    <h1 class="text-h4 mb-4">Issues</h1>

    <v-progress-circular v-if="loading" indeterminate color="primary" data-testid="issues-loading" />
    <v-alert v-else-if="loadError" type="error" density="compact" data-testid="issues-error">{{ loadError }}</v-alert>
    <p v-else-if="loaded && issues.length === 0" class="text-body-1" data-testid="issues-empty">No issues found.</p>

    <v-table v-if="!loading && !loadError && issues.length > 0" data-testid="issues-table">
      <thead>
        <tr>
          <th>Request</th>
          <th>Type</th>
          <th>When</th>
          <th>Vehicle</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="issue in issues" :key="issue.id" data-testid="issue-row">
          <td data-testid="issue-request-id">{{ issue.requestId }}</td>
          <td data-testid="issue-type">{{ typeLabel(issue) }}</td>
          <td data-testid="issue-timing">{{ timingLabel(issue) }}</td>
          <td data-testid="issue-vehicle-id">{{ issue.vehicleId ?? "" }}</td>
          <td>{{ createdLabel(issue) }}</td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>
