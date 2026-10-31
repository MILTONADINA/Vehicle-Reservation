<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import MenuBar from "./components/MenuBar.vue";
import SessionGate from "./components/SessionGate.vue";
import Utils from "./config/utils.js";

const route = useRoute();
const user = ref(Utils.getStore("user"));
const forbidden = ref("");
const showMenu = computed(() => !!route.meta.requiresAuth && !!user.value?.token);

// Refresh the layout when auth state changes (frontend-services.mdc: cross-component events).
const refreshUser = () => { user.value = Utils.getStore("user"); };
const showForbidden = (event) => { forbidden.value = event.detail || "Forbidden."; };
// A denial belongs to the screen it happened on.
watch(() => route.fullPath, () => { forbidden.value = ""; });
onMounted(() => {
  window.addEventListener("user-logged-in", refreshUser);
  window.addEventListener("user-logged-out", refreshUser);
  window.addEventListener("api-forbidden", showForbidden);
});
onBeforeUnmount(() => {
  window.removeEventListener("user-logged-in", refreshUser);
  window.removeEventListener("user-logged-out", refreshUser);
  window.removeEventListener("api-forbidden", showForbidden);
});
</script>

<template>
  <v-app>
    <MenuBar v-if="showMenu" />
    <v-main>
      <v-alert
        v-if="forbidden"
        type="error"
        density="compact"
        class="ma-4"
        closable
        data-testid="forbidden-alert"
        @click:close="forbidden = ''"
      >{{ forbidden }}</v-alert>
      <SessionGate>
        <router-view />
      </SessionGate>
    </v-main>
  </v-app>
</template>

<style>
/* OC Academic Edition — typography (see ui-style-system.mdc) */
.v-application {
  font-family: Inter, sans-serif !important;
  font-size: 16px;
  font-weight: 400;
}

.v-application :is(h1, h2, h3, h4, h5, h6) {
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
}

/* Primary labeled CTAs — shared size for peer buttons */
.v-btn.oc-cta {
  font-size: 0.875rem !important;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-transform: none;
}
</style>
