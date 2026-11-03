import apiClient from "./services.js";

export default {
  getOptions() { return apiClient.get("destinations/options"); },
  getAll() { return apiClient.get("destinations"); },
  create(data) { return apiClient.post("destinations", data); },
  update(id, data) { return apiClient.put(`destinations/${id}`, data); },
  remove(id) { return apiClient.delete(`destinations/${id}`); },
};
