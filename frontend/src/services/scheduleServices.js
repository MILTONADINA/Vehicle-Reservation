import apiClient from "./services.js";

export default {
  getSchedule(params = {}) {
    return apiClient.get("schedule", { params });
  },
  getServiceQueue(params = {}) {
    return apiClient.get("service-queue", { params });
  },
};
