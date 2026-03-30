// src/routes/category.routes.js

import { Router } from "express";
import * as categoryController from "../controllers/category.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validators/category.validator.js";
import { generalLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

// All category routes require authentication
router.use(authenticate);
router.use(generalLimiter);   

// ─── User routes (authenticated) ──────────────────────────────────────────────
router
  .route("/")
  .get(categoryController.listCategories)     // List seeded + user's own
  .post(validate(createCategorySchema), categoryController.createCategory); // Create (max 7)

router
  .route("/:id")
  .get(categoryController.getCategory)        // Get single (seeded or own)
  .patch(validate(updateCategorySchema), categoryController.updateCategory)  // Edit own only
  .delete(categoryController.deleteCategory); // Soft-delete own only

export default router;
