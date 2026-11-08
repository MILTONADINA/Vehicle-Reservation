import { Router } from "express";
import controller from "../controllers/schedule.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();

router.get("/schedule", authenticate, requireRole("admin", "area_admin"), controller.schedule);
router.get("/service-queue", authenticate, requireRole("admin", "area_admin"), controller.serviceQueue);

export default router;
