import { Router } from "express";
import controller from "../controllers/issue.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();

router.get("/", authenticate, requireRole("admin", "area_admin", "maintenance"), controller.listOpen);

export default router;
