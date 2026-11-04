import apiClient from "./services.js";

export default {
  getAll() { return apiClient.get("reservation-requests"); },
  create(data) { return apiClient.post("reservation-requests", data); },
  update(id, data) { return apiClient.put(`reservation-requests/${id}`, data); },
  cancel(id) { return apiClient.put(`reservation-requests/${id}/cancel`); },
};
