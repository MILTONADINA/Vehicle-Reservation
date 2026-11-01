import { Router } from "express";
import controller from "../controllers/vehicle.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();
const managers = ["admin", "area_admin"];

router.get("/options", authenticate, requireRole(...managers), controller.options);
router.get("/", authenticate, requireRole(...managers), controller.list);
router.post("/", authenticate, requireRole(...managers), controller.create);
router.put("/:id", authenticate, requireRole(...managers), controller.update);
router.delete("/:id", authenticate, requireRole(...managers), controller.remove);

export default router;
