import axios from "axios";
import Utils from "../config/utils.js";
import router from "../router.js";

const apiClient = axios.create({
  baseURL: import.meta.env.DEV ? "http://localhost:3200/vehicle-t6/" : "/vehicle-t6/",
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const user = Utils.getStore("user");

  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

// A 401 ends the local session; a 403 on a protected request is announced to the layout without
// signing out. The login request reports its own failures on the Login screen.
export function handleResponseError(error) {
  const status = error.response?.status;
  const message = error.response?.data?.message || "";
  const isLoginRequest = String(error.config?.url || "").replace(/^\/+/, "") === "login";

  if (status === 401 || /Unauthorized/i.test(message)) {
    Utils.removeItem("user");
    window.dispatchEvent(new CustomEvent("user-logged-out"));
    if (router.hasRoute("login")) {
      router.push({ name: "login" });
    }
  } else if (status === 403 && !isLoginRequest) {
    window.dispatchEvent(new CustomEvent("api-forbidden", { detail: message || "Forbidden." }));
  }

  return Promise.reject(error);
}

apiClient.interceptors.response.use((response) => response, handleResponseError);

export default apiClient;
