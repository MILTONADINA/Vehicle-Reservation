<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AuthServices from "../services/authServices.js";
import Utils from "../config/utils.js";

const router = useRouter();
const user = ref(Utils.getStore("user"));
const error = ref("");

const refreshUser = () => { user.value = Utils.getStore("user"); };
onMounted(() => window.addEventListener("user-logged-in", refreshUser));
onBeforeUnmount(() => window.removeEventListener("user-logged-in", refreshUser));

// Ends the server session, then forgets the local one. An already-invalid session (401)
// is treated as signed out; any other failure keeps the session so the user can retry.
async function signOut() {
  error.value = "";
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
    <v-app-bar-title>Vehicle Reservation</v-app-bar-title>
    <span class="mr-4" data-testid="signed-in-email">{{ user?.email }}</span>
    <v-btn data-testid="sign-out" variant="text" @click="signOut">Sign out</v-btn>
  </v-app-bar>
  <v-alert v-if="error" type="error" density="compact" class="ma-4">{{ error }}</v-alert>
</template>
