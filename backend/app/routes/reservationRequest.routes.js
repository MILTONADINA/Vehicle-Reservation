import { Router } from "express";
import controller from "../controllers/reservationRequest.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();

router.get("/", authenticate, requireRole("admin", "area_admin", "requestor"), controller.list);
router.post("/", authenticate, requireRole("requestor"), controller.create);
router.put("/:id", authenticate, requireRole("requestor"), controller.update);
router.put("/:id/cancel", authenticate, requireRole("requestor"), controller.cancel);

export default router;
