import { Router } from "express";
import controller from "../controllers/reservationRequest.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();

router.get("/", authenticate, requireRole("admin", "area_admin", "requestor"), controller.list);
router.post("/", authenticate, requireRole("requestor"), controller.create);
router.get("/:id/candidate-vehicles", authenticate, requireRole("admin", "area_admin"), controller.candidateVehicles);
router.put("/:id/status", authenticate, requireRole("admin", "area_admin"), controller.changeStatus);
router.put("/:id", authenticate, requireRole("requestor"), controller.update);
router.put("/:id/cancel", authenticate, requireRole("requestor"), controller.cancel);

export default router;
