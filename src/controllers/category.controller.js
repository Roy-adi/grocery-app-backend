// src/controllers/category.controller.js
// NEW FILE
// Thin controller: extract → service → respond.

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import * as categoryService from "../services/category.service.js";

// ─── GET /api/v1/categories ───────────────────────────────────────────────────
// Returns seeded categories + the authenticated user's own categories.
export const listCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.listCategories(req.user.userId);

  return new ApiResponse(
    200,
    { categories, count: categories.length },
    "Categories fetched"
  ).send(res);
});

// ─── GET /api/v1/categories/:id ───────────────────────────────────────────────
export const getCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(
    req.params.id,
    req.user.userId
  );

  return new ApiResponse(200, { category }, "Category fetched").send(res);
});

// ─── POST /api/v1/categories ──────────────────────────────────────────────────
export const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.user.userId, req.body);

  return new ApiResponse(201, { category }, "Category created").send(res);
});

// ─── PATCH /api/v1/categories/:id ────────────────────────────────────────────
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(
    req.params.id,
    req.user.userId,
    req.body
  );

  return new ApiResponse(200, { category }, "Category updated").send(res);
});

// ─── DELETE /api/v1/categories/:id ───────────────────────────────────────────
export const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id, req.user.userId);

  return new ApiResponse(200, null, "Category deleted").send(res);
});


