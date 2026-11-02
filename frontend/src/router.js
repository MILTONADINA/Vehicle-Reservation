import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import Login from "./views/Login.vue";
import Areas from "./views/Areas.vue";
import Users from "./views/Users.vue";
import Vehicles from "./views/Vehicles.vue";
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
        path: "/users",
        name: "users",
        component: Users,
        meta: { requiresAuth: true, roles: ["admin", "area_admin"] },
      },
      {
        path: "/vehicles",
        name: "vehicles",
        component: Vehicles,
        meta: { requiresAuth: true, roles: ["admin", "area_admin"] },
      },
      {
        path: "/:pathMatch(.*)*",
        redirect: { name: "home" },
      },
    ],
  });

  // Signed-out visitors are sent to Sign in; the session itself is validated by SessionGate.
  // A route limited to certain roles sends every other signed-in role Home.
  router.beforeEach((to) => {
    const stored = Utils.getStore("user");
    if (to.meta.requiresAuth && !stored?.token) {
      return { name: "login" };
    }
    if (to.meta.roles && !to.meta.roles.includes(stored?.role)) {
      return { name: "home" };
    }
  });

  return router;
}

export default createAppRouter();
