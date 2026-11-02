import { Router } from "express";
import controller from "../controllers/driver.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();
const managers = ["admin", "area_admin"];

// Every signed-in role may read drivers and the license-state list; only managers write.
router.get("/options", authenticate, controller.options);
router.get("/", authenticate, controller.list);
router.post("/", authenticate, requireRole(...managers), controller.create);
router.put("/:id", authenticate, requireRole(...managers), controller.update);
router.delete("/:id", authenticate, requireRole(...managers), controller.remove);

export default router;
