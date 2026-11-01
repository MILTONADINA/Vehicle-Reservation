import apiClient from "./services.js";

export default {
  getAll() { return apiClient.get("areas"); },
  create(data) { return apiClient.post("areas", data); },
  update(id, data) { return apiClient.put(`areas/${id}`, data); },
  remove(id) { return apiClient.delete(`areas/${id}`); },
};
