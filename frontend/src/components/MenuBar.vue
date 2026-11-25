<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import AuthServices from "../services/authServices.js";
import Utils from "../config/utils.js";

const router = useRouter();
// Below the md breakpoint the links move into a drawer so the bar never cuts them off.
const { mdAndUp } = useDisplay();
const drawer = ref(false);
const user = ref(Utils.getStore("user"));
const error = ref("");

const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

// Only the two manager roles see Users, Vehicles, Drivers, and Destinations; the route guard enforces the same rule.
const NAV_LINKS = [
  { name: "home", label: "Home", testid: "nav-home" },
  { name: "areas", label: "Areas", testid: "nav-areas" },
  { name: "users", label: "Users", testid: "nav-users", roles: ["admin", "area_admin"] },
  { name: "vehicles", label: "Vehicles", testid: "nav-vehicles", roles: ["admin", "area_admin"] },
  { name: "drivers", label: "Drivers", testid: "nav-drivers", roles: ["admin", "area_admin"] },
  { name: "destinations", label: "Destinations", testid: "nav-destinations", roles: ["admin", "area_admin"] },
  { name: "reservation-requests", label: "Requests", testid: "nav-requests", roles: ["requestor", "admin", "area_admin"] },
  { name: "issues", label: "Issues", testid: "nav-issues", roles: ["admin", "area_admin", "maintenance"] },
  { name: "schedule", label: "Schedule", testid: "nav-schedule", roles: ["admin", "area_admin"] },
  { name: "maintenance", label: "Maintenance", testid: "nav-maintenance", roles: ["admin", "maintenance"] },
];
const links = computed(() => NAV_LINKS.filter((link) => !link.roles || link.roles.includes(user.value?.role)));

// Ends the server session, then forgets the local one. An already-invalid session (401)
// is treated as signed out; any other failure keeps the session so the user can retry.
async function signOut() {
  error.value = "";
  drawer.value = false;
  try {
    await AuthServices.logoutUser();
  } catch (reason) {
    if (reason.response?.status !== 401) {
      error.value = "Sign-out could not be completed. Try again.";
      return;
    }
  }
  Utils.removeItem("user");
  window.dispatchEvent(new CustomEvent("user-logged-out"));
  await router.push({ name: "login" });
}
</script>

<template>
  <v-app-bar color="primary" density="comfortable">
    <v-app-bar-nav-icon v-if="!mdAndUp" aria-label="Open navigation" data-testid="nav-menu" @click="drawer = !drawer" />
    <v-app-bar-title>Vehicle Reservation</v-app-bar-title>
    <template v-if="mdAndUp">
      <v-btn v-for="link in links" :key="link.name" :to="{ name: link.name }" variant="text" :data-testid="link.testid">{{ link.label }}</v-btn>
      <span class="mx-4" data-testid="signed-in-email">{{ user?.email }}</span>
      <v-btn data-testid="sign-out" variant="text" @click="signOut">Sign out</v-btn>
    </template>
  </v-app-bar>
  <v-navigation-drawer v-if="!mdAndUp" v-model="drawer" temporary data-testid="nav-drawer">
    <v-list nav>
      <v-list-item :title="user?.email" data-testid="signed-in-email" />
      <v-divider class="my-2" />
      <v-list-item
        v-for="link in links"
        :key="link.name"
        :to="{ name: link.name }"
        :title="link.label"
        :data-testid="link.testid"
        @click="drawer = false"
      />
      <v-divider class="my-2" />
      <v-list-item title="Sign out" data-testid="sign-out" @click="signOut" />
    </v-list>
  </v-navigation-drawer>
  <v-alert v-if="error" type="error" density="compact" class="ma-4">{{ error }}</v-alert>
</template>
