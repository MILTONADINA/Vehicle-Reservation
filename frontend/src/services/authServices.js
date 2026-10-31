import apiClient from "./services.js";

export default {
  loginWithGoogle(data) { return apiClient.post("login", data); },
  me() { return apiClient.get("auth/me"); },
  logoutUser() { return apiClient.post("logout"); },
};
