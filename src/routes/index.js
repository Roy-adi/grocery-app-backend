import express from "express";

import authRoutes from "./auth.routes.js";
import categoryRoutes from "./category.routes.js";
import groceryRoutes from './grocery.routes.js'

const router = express.Router();

//  Auth routes
router.use("/auth", authRoutes);

//  Category routes
router.use("/categories", categoryRoutes);

// grocery routes
router.use("/grocery", groceryRoutes);

export default router;