// src/routes/auth.routes.js

import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/auth.js";
import { generalLimiter, loginLimiter } from "../middlewares/rateLimiter.js";
import { signupSchema, loginSchema } from "../validators/auth.validator.js";

const router = Router();

// Route → Middleware → Validation → Controller
// (see Data Flow Architecture in requirements)

router.post("/signup", validate(signupSchema), authController.signup);

router.post("/login", loginLimiter, validate(loginSchema), authController.login);

router.get("/logout", authenticate, authController.logout);

router.get("/refresh", authController.refresh);

router.get("/me", authenticate,generalLimiter, authController.getMe);

export default router;
