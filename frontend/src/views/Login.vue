<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AuthServices from "../services/authServices.js";
import Utils from "../config/utils.js";

const router = useRouter();
const error = ref("");
const loading = ref(false);
const scriptUnavailable = ref(false);
const buttonHost = ref(null);
const SCRIPT_WAIT_MS = 5000;
let scriptTimer = null;

// Google calls this with an ID token once the visitor picks an OC account.
async function handleCredentialResponse(response) {
  if (loading.value || !response?.credential) {
    return;
  }
  error.value = "";
  loading.value = true;
  try {
    const result = await AuthServices.loginWithGoogle({ credential: response.credential });
    Utils.setStore("user", result.data);
    window.dispatchEvent(new CustomEvent("user-logged-in"));
    await router.push({ name: "home" });
  } catch (reason) {
    error.value = reason.response?.data?.message || "Sign-in could not be completed.";
  } finally {
    loading.value = false;
  }
}

// A closed Google prompt never calls back, so cancelling simply leaves the visitor signed out.
function renderGoogleButton() {
  const googleId = window.google?.accounts?.id;
  if (!googleId || !buttonHost.value) {
    return;
  }
  clearTimeout(scriptTimer);
  scriptUnavailable.value = false;
  googleId.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
  });
  googleId.renderButton(buttonHost.value, { theme: "outline", size: "large", text: "signin_with", width: 280 });
}

// The Google script loads asynchronously; if it is not ready yet, it calls onGoogleLibraryLoad when it is.
// If it never arrives (blocked or offline), the screen says so instead of showing an empty card.
onMounted(() => {
  if (window.google?.accounts?.id) {
    renderGoogleButton();
  } else {
    window.onGoogleLibraryLoad = renderGoogleButton;
    scriptTimer = setTimeout(() => {
      scriptUnavailable.value = !window.google?.accounts?.id;
    }, SCRIPT_WAIT_MS);
  }
});

onBeforeUnmount(() => {
  clearTimeout(scriptTimer);
  if (window.onGoogleLibraryLoad === renderGoogleButton) {
    delete window.onGoogleLibraryLoad;
  }
});
</script>

<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card rounded="lg" elevation="4" class="pa-6">
          <h1 class="text-h4 mb-2">Sign in</h1>
          <p class="text-body-1 mb-6">Use your OC Google account.</p>
          <v-alert v-if="error" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
          <v-alert v-if="scriptUnavailable" type="error" density="compact" class="mb-4" data-testid="google-unavailable">
            Google sign-in could not be loaded. Reload the page.
          </v-alert>
          <div ref="buttonHost" data-testid="google-signin" class="mb-4"></div>
          <v-progress-circular v-if="loading" indeterminate color="primary" data-testid="login-loading" />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
