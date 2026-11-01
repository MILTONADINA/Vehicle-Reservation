import apiClient from "./services.js";

export default {
  getAll() { return apiClient.get("users"); },
  create(data) { return apiClient.post("users", data); },
  update(id, data) { return apiClient.put(`users/${id}`, data); },
  remove(id) { return apiClient.delete(`users/${id}`); },
};
