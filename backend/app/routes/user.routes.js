import { Router } from "express";
import controller from "../controllers/user.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();

router.get("/", authenticate, requireRole("admin", "area_admin"), controller.list);
router.post("/", authenticate, requireRole("admin"), controller.create);
router.put("/:id", authenticate, requireRole("admin", "area_admin"), controller.update);
router.delete("/:id", authenticate, requireRole("admin", "area_admin"), controller.remove);

export default router;
