import { Router } from "express";
import authRoutes from "./auth.routes.js";
import areaRoutes from "./area.routes.js";
import userRoutes from "./user.routes.js";
import vehicleRoutes from "./vehicle.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/", authRoutes);
router.use("/areas", areaRoutes);
router.use("/users", userRoutes);
router.use("/vehicles", vehicleRoutes);

export default router;
