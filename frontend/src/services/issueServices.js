import apiClient from "./services.js";

export default {
  listOpen() {
    return apiClient.get("issues");
  },
  listForRequest(requestId) {
    return apiClient.get(`reservation-requests/${requestId}/issues`);
  },
  createForRequest(requestId, data) {
    return apiClient.post(`reservation-requests/${requestId}/issues`, data);
  },
};
