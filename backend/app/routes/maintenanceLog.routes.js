import { Router } from "express";
import controller from "../controllers/maintenanceLog.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();
const staff = ["admin", "maintenance"];

router.get("/maintenance/vehicles", authenticate, requireRole(...staff), controller.listVehicles);
router.get("/vehicles/:vehicleId/mileage-logs", authenticate, requireRole(...staff), controller.listMileage);
router.post("/vehicles/:vehicleId/mileage-logs", authenticate, requireRole(...staff), controller.createMileage);
router.get("/vehicles/:vehicleId/service-logs", authenticate, requireRole(...staff), controller.listService);
router.post("/vehicles/:vehicleId/service-logs", authenticate, requireRole(...staff), controller.createService);

export default router;
