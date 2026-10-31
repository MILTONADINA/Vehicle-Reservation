import { Router } from "express";
import authRoutes from "./auth.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/", authRoutes);

export default router;
