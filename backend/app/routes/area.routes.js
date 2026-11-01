import { Router } from "express";
import controller from "../controllers/area.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();

router.get("/", authenticate, controller.list);
router.post("/", authenticate, requireRole("admin"), controller.create);
router.put("/:id", authenticate, requireRole("admin", "area_admin"), controller.update);
router.delete("/:id", authenticate, requireRole("admin"), controller.remove);

export default router;
