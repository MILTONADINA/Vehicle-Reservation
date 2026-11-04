import { Router } from "express";
import controller from "../controllers/reservationEmail.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();

router.post("/send-now", authenticate, requireRole("admin"), controller.sendNow);

export default router;
