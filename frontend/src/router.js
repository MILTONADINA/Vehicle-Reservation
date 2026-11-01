import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import Login from "./views/Login.vue";
import Areas from "./views/Areas.vue";
import Utils from "./config/utils.js";

export function createAppRouter() {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
      {
        path: "/",
        name: "home",
        component: Home,
        meta: { requiresAuth: true },
      },
      {
        path: "/login",
        name: "login",
        component: Login,
      },
      {
        path: "/areas",
        name: "areas",
        component: Areas,
        meta: { requiresAuth: true },
      },
      {
        path: "/:pathMatch(.*)*",
        redirect: { name: "home" },
      },
    ],
  });

  // Signed-out visitors are sent to Sign in; the session itself is validated by SessionGate.
  router.beforeEach((to) => {
    if (to.meta.requiresAuth && !Utils.getStore("user")?.token) {
      return { name: "login" };
    }
  });

  return router;
}

export default createAppRouter();
