<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import UserServices from "../services/userServices.js";
import AreaServices from "../services/areaServices.js";
import Utils from "../config/utils.js";
import { APPROVED_EMAIL_DOMAINS } from "../config/auth.js";

const LIMITS = { email: 254, name: 100 };
const ROLES = ["admin", "area_admin", "requestor", "maintenance"];
const ORDINARY_ROLES = ["requestor", "maintenance"];
const PRIVILEGED_ROLES = ["admin", "area_admin"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

const user = ref(Utils.getStore("user"));
const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

const isAdmin = computed(() => user.value?.role === "admin");
const isSelf = (record) => record.id === user.value?.userId;
// Admin manages every account; an area admin manages only requestor and maintenance accounts.
const canManage = (record) => isAdmin.value || !PRIVILEGED_ROLES.includes(record.role);
const canDelete = (record) => canManage(record) && !isSelf(record);

const users = ref([]);
const loading = ref(false);
const loaded = ref(false);
const loadError = ref("");
const areas = ref([]);
const areasError = ref("");

async function loadUsers() {
  loadError.value = "";
  try {
    const result = await UserServices.getAll();
    users.value = result.data;
    loaded.value = true;
  } catch (reason) {
    loadError.value = reason.response?.data?.message || "Users could not be loaded.";
  }
}
// Area names come from Feature 2. Without them, Add and Edit stay blocked until a reload succeeds.
async function loadAreas() {
  areasError.value = "";
  try {
    const result = await AreaServices.getAll();
    areas.value = result.data;
  } catch (reason) {
    areasError.value = reason.response?.data?.message || "Area options could not be loaded.";
  }
}
// Progress covers both requests, so rows never appear before their area names can.
async function load() {
  loading.value = true;
  await Promise.all([loadUsers(), loadAreas()]);
  loading.value = false;
}
onMounted(load);

const writesBlocked = computed(() => areasError.value !== "");
function areaLabel(areaId) {
  if (areaId === null) return "Unassigned";
  return areas.value.find((area) => area.id === areaId)?.areaName ?? "Unavailable";
}

// The same rules the API applies, so an invalid form never sends a write.
const trimmedField = (value, limit) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= limit ? text : null;
};
const normalizedEmail = (value) => {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > LIMITS.email || !EMAIL_PATTERN.test(email)) return null;
  return APPROVED_EMAIL_DOMAINS.includes(email.split("@")[1]) ? email : null;
};

const emptyForm = () => ({ email: "", firstName: "", lastName: "", role: null, areaId: null });
const dialog = reactive({ open: false, editing: null, saving: false, error: "", form: emptyForm() });
const formRef = ref(null);

const roleOptions = computed(() => (isAdmin.value ? ROLES : ORDINARY_ROLES));
const areaOptions = computed(() => areas.value.map((area) => ({ title: area.areaName, value: area.id })));
// Only an admin assigns areas, and only to an area admin; every other role is Unassigned.
const areaEnabled = computed(() => isAdmin.value && dialog.form.role === "area_admin");
// A locked Area control displays Unassigned instead of an empty field.
const UNASSIGNED = [{ title: "Unassigned", value: null }];
const areaItems = computed(() => (areaEnabled.value ? areaOptions.value : UNASSIGNED));
// An admin cannot change their own role; the API refuses it as well.
const roleLocked = computed(() => isAdmin.value && dialog.editing !== null && isSelf(dialog.editing));

function setRole(role) {
  dialog.form.role = role;
  if (role !== "area_admin") dialog.form.areaId = null;
}

function validUserFields(form, editing) {
  const firstName = trimmedField(form.firstName, LIMITS.name);
  const lastName = trimmedField(form.lastName, LIMITS.name);
  const role = roleOptions.value.includes(form.role) ? form.role : null;
  if (!firstName || !lastName || !role) return null;
  const areaId = role === "area_admin" ? form.areaId : null;
  if (role === "area_admin" && !areaOptions.value.some((option) => option.value === areaId)) return null;
  const fields = { firstName, lastName, role, areaId };
  if (editing) return fields;
  const email = normalizedEmail(form.email);
  return email ? { email, ...fields } : null;
}

const INVALID = "Invalid user data.";
const required = (value) => (typeof value === "string" && value.trim().length > 0) || INVALID;
const rules = {
  email: [(value) => dialog.editing !== null || normalizedEmail(value) !== null || INVALID],
  firstName: [required, (value) => (value ?? "").trim().length <= LIMITS.name || INVALID],
  lastName: [required, (value) => (value ?? "").trim().length <= LIMITS.name || INVALID],
  role: [(value) => roleOptions.value.includes(value) || INVALID],
  areaId: [(value) => !areaEnabled.value || areaOptions.value.some((option) => option.value === value) || INVALID],
};

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
const openEdit = (record) => openDialog(record, {
  email: record.email,
  firstName: record.firstName,
  lastName: record.lastName,
  role: record.role,
  areaId: record.areaId,
});
function cancelDialog() {
  formRef.value?.resetValidation();
  dialog.open = false;
  dialog.error = "";
  dialog.form = emptyForm();
}
async function save() {
  if (dialog.saving) return;
  const fields = validUserFields(dialog.form, dialog.editing);
  if (!fields) {
    dialog.error = INVALID;
    return;
  }
  dialog.saving = true;
  dialog.error = "";
  try {
    if (dialog.editing) {
      await UserServices.update(dialog.editing.id, fields);
    } else {
      await UserServices.create(fields);
    }
    dialog.open = false;
    dialog.form = emptyForm();
    await load();
  } catch (reason) {
    dialog.error = reason.response?.data?.message || "User could not be saved.";
  } finally {
    dialog.saving = false;
  }
}

const removal = reactive({ open: false, record: null, deleting: false, error: "" });
function openDelete(record) {
  removal.record = record;
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
    await UserServices.remove(removal.record.id);
    removal.open = false;
    await load();
  } catch (reason) {
    removal.error = reason.response?.data?.message || "User could not be deleted.";
  } finally {
    removal.deleting = false;
  }
}
</script>

<template>
  <v-container class="py-10">
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h4">Users</h1>
      <v-btn v-if="isAdmin" color="primary" variant="elevated" class="oc-cta" :disabled="writesBlocked" data-testid="add-user" @click="openAdd">Add user</v-btn>
    </div>

    <v-alert v-if="areasError" type="error" density="compact" class="mb-4" data-testid="user-areas-error">{{ areasError }}</v-alert>

    <v-progress-circular v-if="loading" indeterminate color="primary" data-testid="users-loading" />
    <v-alert v-else-if="loadError" type="error" density="compact" data-testid="users-error">{{ loadError }}</v-alert>
    <p v-else-if="loaded && users.length === 0" class="text-body-1" data-testid="users-empty">No users found.</p>

    <v-table v-if="!loading && !loadError && users.length > 0">
      <thead>
        <tr>
          <th>Email</th>
          <th>First name</th>
          <th>Last name</th>
          <th>Role</th>
          <th>Area</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="record in users" :key="record.id" data-testid="user-row">
          <td>{{ record.email }}</td>
          <td>{{ record.firstName }}</td>
          <td>{{ record.lastName }}</td>
          <td>{{ record.role }}</td>
          <td>{{ areaLabel(record.areaId) }}</td>
          <td>
            <v-btn v-if="canManage(record)" size="small" variant="text" color="primary" :disabled="writesBlocked" data-testid="edit-user" @click="openEdit(record)">Edit</v-btn>
            <v-btn v-if="canDelete(record)" size="small" variant="text" color="error" data-testid="delete-user" @click="openDelete(record)">Delete</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <v-dialog v-model="dialog.open" max-width="560" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="user-dialog">
        <h2 class="text-h6 mb-4">{{ dialog.editing ? "Edit user" : "Add user" }}</h2>
        <v-alert v-if="dialog.error" type="error" density="compact" class="mb-4" data-testid="user-form-error">{{ dialog.error }}</v-alert>
        <v-form ref="formRef" @submit.prevent="save">
          <v-text-field v-model="dialog.form.email" label="Email" type="email" :rules="rules.email" :maxlength="LIMITS.email" :readonly="dialog.editing !== null" data-testid="user-email" />
          <v-text-field v-model="dialog.form.firstName" label="First name" :rules="rules.firstName" :maxlength="LIMITS.name" data-testid="user-first" />
          <v-text-field v-model="dialog.form.lastName" label="Last name" :rules="rules.lastName" :maxlength="LIMITS.name" data-testid="user-last" />
          <v-select :model-value="dialog.form.role" label="Role" :items="roleOptions" :rules="rules.role" :disabled="roleLocked" data-testid="user-role" @update:model-value="setRole" />
          <v-select
            v-model="dialog.form.areaId"
            label="Area"
            :items="areaItems"
            :rules="rules.areaId"
            :disabled="!areaEnabled"
            data-testid="user-area"
          />
          <div class="d-flex justify-end mt-4">
            <v-btn color="secondary" variant="text" class="mr-2" :disabled="dialog.saving" data-testid="cancel-user" @click="cancelDialog">Cancel</v-btn>
            <v-btn type="submit" color="primary" variant="elevated" class="oc-cta" :loading="dialog.saving" :disabled="dialog.saving" data-testid="save-user">Save</v-btn>
          </div>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="removal.open" max-width="420" persistent>
      <v-card rounded="lg" class="pa-6" data-testid="delete-user-dialog">
        <h2 class="text-h6 mb-2">Delete user</h2>
        <p class="text-body-1 mb-4">Delete this user?</p>
        <v-alert v-if="removal.error" type="error" density="compact" class="mb-4" data-testid="delete-user-error">{{ removal.error }}</v-alert>
        <div class="d-flex justify-end">
          <v-btn color="secondary" variant="text" class="mr-2" :disabled="removal.deleting" data-testid="cancel-delete-user" @click="cancelDelete">Cancel</v-btn>
          <v-btn color="error" variant="elevated" class="oc-cta" :loading="removal.deleting" :disabled="removal.deleting" data-testid="confirm-delete-user" @click="confirmDelete">Delete</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>
