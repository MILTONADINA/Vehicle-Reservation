import apiClient from "./services.js";

export default {
  listVehicles() {
    return apiClient.get("maintenance/vehicles");
  },
  listMileage(vehicleId) {
    return apiClient.get(`vehicles/${vehicleId}/mileage-logs`);
  },
  createMileage(vehicleId, data) {
    return apiClient.post(`vehicles/${vehicleId}/mileage-logs`, data);
  },
  listService(vehicleId) {
    return apiClient.get(`vehicles/${vehicleId}/service-logs`);
  },
  createService(vehicleId, data) {
    return apiClient.post(`vehicles/${vehicleId}/service-logs`, data);
  },
};
