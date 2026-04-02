// src/controllers/grocery.controller.js
// Thin controller: extract → service → respond.

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import * as groceryService from "../services/grocery.service.js";

// ─── POST /api/v1/grocery ─────────────────────────────────────────────────────
export const createGroceryItem = asyncHandler(async (req, res) => {
  const item = await groceryService.createGroceryItem(
    req.user.userId,
    req.body, // Already validated by validate() middleware
  );

  return new ApiResponse(201, { item }, "Grocery item created").send(res);
});

// ─── GET /api/v1/grocery ──────────────────────────────────────────────────────
export const getUserGroceryItems = asyncHandler(async (req, res) => {
  const result = await groceryService.getUserGroceryItems(
    req.user.userId,
    req.query,
  );

  return new ApiResponse(200, result, "Grocery items fetched").send(res);
});



// update Grocery Item
export const updateGroceryItem = asyncHandler(async (req, res) => {
  const item = await groceryService.updateGroceryItem(
    req.user.userId,
    req.params.id,
    req.body,
  );

  return new ApiResponse(200, { item }, "Grocery item updated").send(res);
});

// grocery bulk add

export const bulkCreateGrocery = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items?.length) {
    throw new ApiError(400, "No items provided");
  }

  const result = await groceryService.bulkCreateGroceryItems(
    req.user.userId,
    items,
  );

  return new ApiResponse(201, result, "Grocery items processed").send(res);
});

// ─── DELETE /api/v1/grocery/:id ───────────────────────────────────────────────
// Soft delete pattern
export const softDeleteGroceryItem = asyncHandler(async (req, res) => {
  const result = await groceryService.softDeleteGroceryItem(
    req.user.userId,
    req.params.id,
  );

  return new ApiResponse(200, result, "Grocery item deleted").send(res);
});

// grocery service insight
export const getGroceryInsights = asyncHandler(async (req, res) => {
  const insights = await groceryService.getGroceryInsight(req.user.userId);

  return new ApiResponse(200, insights, "Insights fetched").send(res);
});

// grocery item details

export const getgroceryItemDetails = asyncHandler(async (req, res) => {
  const result = await groceryService.getgroceryItemDetail(
    req.user.userId,
    req.params.id,
  );

  return new ApiResponse(200, result, "Grocery item details").send(res);
});