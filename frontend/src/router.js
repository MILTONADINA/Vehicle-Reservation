import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import Login from "./views/Login.vue";
import Areas from "./views/Areas.vue";
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

  // Signed-out visitors go to Sign in; disallowed roles on Vehicles are sent Home.
  router.beforeEach((to) => {
    const user = Utils.getStore("user");
    if (to.meta.requiresAuth && !user?.token) {
      return { name: "login" };
    }
    if (to.meta.roles && user?.token && !to.meta.roles.includes(user.role)) {
      return { name: "home" };
    }
  });

  return router;
}

export default createAppRouter();
