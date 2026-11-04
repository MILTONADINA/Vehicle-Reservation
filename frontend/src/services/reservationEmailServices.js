import apiClient from "./services.js";

export default {
  sendNow() { return apiClient.post("reservation-emails/send-now"); },
};
