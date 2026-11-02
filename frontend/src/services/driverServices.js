import apiClient from "./services.js";

export default {
  getOptions() { return apiClient.get("drivers/options"); },
  getAll() { return apiClient.get("drivers"); },
  create(data) { return apiClient.post("drivers", data); },
  update(id, data) { return apiClient.put(`drivers/${id}`, data); },
  remove(id) { return apiClient.delete(`drivers/${id}`); },
};
