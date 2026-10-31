<script setup>
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AuthServices from "../services/authServices.js";
import Utils from "../config/utils.js";

const route = useRoute();
const router = useRouter();
// ready: show the page; checking: waiting on /auth/me; failed: the check itself failed.
// Nothing renders until the router has resolved the first route and that route has been checked.
const state = ref("checking");

// Protected pages wait for /auth/me so the account shown always comes from the server.
// A check only applies to the navigation that started it; a late result for another screen is dropped.
async function check() {
  if (!route.meta.requiresAuth) {
    state.value = "ready";
    return;
  }
  const startedFor = route.fullPath;
  const startedWithToken = Utils.getStore("user")?.token;
  const stillCurrent = () =>
    route.fullPath === startedFor && !!route.meta.requiresAuth && !!startedWithToken && Utils.getStore("user")?.token === startedWithToken;
  state.value = "checking";
  try {
    const result = await AuthServices.me();
    if (!stillCurrent()) {
      return;
    }
    const stored = Utils.getStore("user");
    Utils.setStore("user", { ...stored, ...result.data, token: stored.token });
    window.dispatchEvent(new CustomEvent("user-logged-in"));
    state.value = "ready";
  } catch (reason) {
    // A 401 is handled by the API client, which clears the session and opens Sign in.
    if (stillCurrent() && reason.response?.status !== 401) {
      state.value = "failed";
    }
  }
}

// A page load resolves its first route without changing the path, so the first check waits for the router.
router.isReady().then(check);
watch(() => route.fullPath, check);
</script>

<template>
  <slot v-if="state === 'ready'" />
  <v-container v-else-if="state === 'failed'" class="py-10">
    <v-alert type="error" density="compact" class="mb-4">Session could not be checked.</v-alert>
    <v-btn color="primary" variant="elevated" class="oc-cta" data-testid="session-retry" @click="check">Retry</v-btn>
  </v-container>
  <v-container v-else class="py-10 text-center">
    <v-progress-circular indeterminate color="primary" />
  </v-container>
</template>
