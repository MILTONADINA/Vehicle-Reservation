<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import AreaServices from "../services/areaServices.js";
import Utils from "../config/utils.js";

const LIMITS = { areaName: 100, areaLogo: 2048, noticeEmail: 5000 };
const NOTICE_HINT = "Your area's day-before-trip instructions. Trip details are added automatically.";

const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const isAdmin = computed(() => user.value?.role === "admin");
// An area admin edits only the area stored on its account; the list itself is visible to every role.
const canEdit = (area) => isAdmin.value || (user.value?.role === "area_admin" && user.value?.areaId === area.id);

const areas = ref([]);
const loading = ref(false);
const loaded = ref(false);
const loadError = ref("");

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const result = await AreaServices.getAll();
    areas.value = result.data;
    loaded.value = true;
  } catch (reason) {
    loadError.value = reason.response?.data?.message || "Areas could not be loaded.";
  } finally {
    loading.value = false;
  }
}
onMounted(load);

// The same rules the API applies, so an invalid form never sends a write.
const trimmedField = (value, limit) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= limit ? text : null;
};
const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
};
function validAreaFields(form) {
  const areaName = trimmedField(form.areaName, LIMITS.areaName);
  const areaLogo = trimmedField(form.areaLogo, LIMITS.areaLogo);
  const noticeEmail = trimmedField(form.noticeEmail, LIMITS.noticeEmail);
  if (!areaName || !areaLogo || !noticeEmail || !isHttpsUrl(areaLogo)) return null;
  return { areaName, areaLogo, noticeEmail };
}
const required = (value) => (typeof value === "string" && value.trim().length > 0) || "Invalid area data.";
const rules = {
  areaName: [required, (value) => (value ?? "").trim().length <= LIMITS.areaName || "Invalid area data."],
  areaLogo: [required, (value) => isHttpsUrl((value ?? "").trim()) || "Invalid area data."],
  noticeEmail: [required, (value) => (value ?? "").trim().length <= LIMITS.noticeEmail || "Invalid area data."],
};

const emptyForm = () => ({ areaName: "", areaLogo: "", noticeEmail: "" });
const dialog = reactive({ open: false, editing: null, saving: false, error: "", form: emptyForm() });
const formRef = ref(null);

// Opening always starts clean: previous values and validation messages are discarded.
async function openDialog(editing, form) {
  dialog.editing = editing;
  dialog.form = form;
  dialog.error = "";
  dialog.open = true;
  await nextTick();
  formRef.value?.resetValidation();
}
const openAdd = () => openDialog(null, emptyForm());
const openEdit = (area) => openDialog(area, { areaName: area.areaName, areaLogo: area.areaLogo, noticeEmail: area.noticeEmail });
function cancelDialog() {
  formRef.value?.resetValidation();
  dialog.open = false;
  dialog.error = "";
  dialog.form = emptyForm();
}
async function save() {
  if (dialog.saving) return;
  const fields = validAreaFields(dialog.form);
  if (!fields) {
    dialog.error = "Invalid area data.";
    return;
  }
  dialog.saving = true;
  dialog.error = "";
  try {
    if (dialog.editing) {
      await AreaServices.update(dialog.editing.id, fields);
    } else {
      await AreaServices.create(fields);
    }
    dialog.open = false;
    dialog.form = emptyForm();
    await load();
  } catch (reason) {
    dialog.error = reason.response?.data?.message || "Area could not be saved.";
  } finally {
    dialog.saving = false;
  }
}

const removal = reactive({ open: false, area: null, deleting: false, error: "" });
function openDelete(area) {
  removal.area = area;
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
    await AreaServices.remove(removal.area.id);
    removal.open = false;
    await load();
  } catch (reason) {
    removal.error = reason.response?.data?.message || "Area could not be deleted.";
  } finally {
    removal.deleting = false;
  }
}
</script>

<template>
  <v-container class="py-10">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Areas</h1>
      <v-btn v-if="isAdmin" color="primary" variant="elevated" class="oc-cta" data-testid="add-area" @click="openAdd">Add area</v-btn>
    </div>

    <v-progress-circular v-if="loading" indeterminate color="primary" data-testid="areas-loading" />
    <v-alert v-else-if="loadError" type="error" density="compact" data-testid="areas-error">{{ loadError }}</v-alert>
    <p v-else-if="loaded && areas.length === 0" class="text-body-1" data-testid="areas-empty">No areas found.</p>

    <v-table v-if="!loading && !loadError && areas.length > 0">
      <thead>
        <tr>
          <th>Area name</th>
          <th>Logo</th>
          <th>Notice email</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="area in areas" :key="area.id" data-testid="area-row">
          <td>{{ area.areaName }}</td>
          <td><img :src="area.areaLogo" :alt="area.areaName" height="40" /></td>
          <td><span class="area-notice" data-testid="area-notice-text">{{ area.noticeEmail }}</span></td>
          <td>
            <v-btn v-if="canEdit(area)" size="small" variant="text" color="primary" data-testid="edit-area" @click="openEdit(area)">Edit</v-btn>
            <v-btn v-if="isAdmin" size="small" variant="text" color="error" data-testid="delete-area" @click="openDelete(area)">Delete</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="dialog.open" max-width="560" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="area-dialog">
        <h2 class="text-h6 mb-4">{{ dialog.editing ? "Edit area" : "Add area" }}</h2>
        <v-alert v-if="dialog.error" type="error" density="compact" class="mb-4" data-testid="area-form-error">{{ dialog.error }}</v-alert>
        <v-form ref="formRef" @submit.prevent="save">
          <v-text-field v-model="dialog.form.areaName" label="Area name" :rules="rules.areaName" :maxlength="LIMITS.areaName" data-testid="area-name" />
          <v-text-field v-model="dialog.form.areaLogo" label="Logo URL" :rules="rules.areaLogo" data-testid="area-logo" />
          <v-textarea
            v-model="dialog.form.noticeEmail"
            label="Notice email"
            :rules="rules.noticeEmail"
            :maxlength="LIMITS.noticeEmail"
            counter
            :hint="NOTICE_HINT"
            persistent-hint
            rows="4"
            data-testid="area-notice"
          />
          <div class="d-flex justify-end mt-4">
            <v-btn color="secondary" variant="text" class="mr-2" :disabled="dialog.saving" data-testid="cancel-area" @click="cancelDialog">Cancel</v-btn>
            <v-btn type="submit" color="primary" variant="elevated" class="oc-cta" :loading="dialog.saving" :disabled="dialog.saving" data-testid="save-area">Save</v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="removal.open" max-width="420" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="delete-dialog">
        <h2 class="text-h6 mb-2">Delete area</h2>
        <p class="text-body-1 mb-4">Delete this area?</p>
        <v-alert v-if="removal.error" type="error" density="compact" class="mb-4" data-testid="delete-error">{{ removal.error }}</v-alert>
        <div class="d-flex justify-end">
          <v-btn color="secondary" variant="text" class="mr-2" :disabled="removal.deleting" data-testid="cancel-delete" @click="cancelDelete">Cancel</v-btn>
          <v-btn color="error" variant="elevated" class="oc-cta" :loading="removal.deleting" :disabled="removal.deleting" data-testid="confirm-delete" @click="confirmDelete">Delete</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.area-notice {
  white-space: pre-wrap;
}
</style>
