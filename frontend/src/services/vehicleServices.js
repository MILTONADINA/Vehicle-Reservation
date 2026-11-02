import apiClient from "./services.js";

export default {
  getOptions() { return apiClient.get("vehicles/options"); },
  getAll() { return apiClient.get("vehicles"); },
  create(data) { return apiClient.post("vehicles", data); },
  update(id, data) { return apiClient.put(`vehicles/${id}`, data); },
  remove(id) { return apiClient.delete(`vehicles/${id}`); },
};
