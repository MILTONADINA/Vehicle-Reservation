import { Router } from "express";
import controller from "../controllers/auth.controller.js";
import { authenticate } from "../authorization/authorization.js";

const router = Router();

router.post("/login", controller.login);
router.get("/auth/me", authenticate, controller.me);
router.post("/logout", authenticate, controller.logout);

export default router;
