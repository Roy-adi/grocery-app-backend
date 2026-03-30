// src/routes/grocery.routes.js
// All routes are protected — authenticate runs first on every request.

import { Router } from "express";
import * as groceryController from "../controllers/grocery.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/auth.js";
import { createGroceryItemSchema } from "../validators/grocery.validator.js";
import { generalLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

// Apply authenticate to every route in this file
router.use(authenticate);     //  sets req.user
router.use(generalLimiter);   //  now has access to req.user

router
  .route("/")
  .post(validate(createGroceryItemSchema), groceryController.createGroceryItem)
  .get(groceryController.getUserGroceryItems);

router.route("/update/:id").patch(groceryController.updateGroceryItem);

router.route("/:id").delete(groceryController.softDeleteGroceryItem);


export default router;
