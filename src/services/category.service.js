// src/services/category.service.js
// NEW FILE
// All category business logic lives here. Controllers stay thin.

import { Category } from "../models/Category.model.js";
import { ApiError } from "../utils/ApiError.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_CATEGORY_LIMIT = 7; // Max categories a regular user can create

// ─── User-facing operations ───────────────────────────────────────────────────

/**
 * List categories visible to the authenticated user:
 *   1. All active admin-seeded (isSeeded: true) categories
 *   2. All active categories the user created (user_id: userId)
 * Seeded categories come first, then user-created sorted alphabetically.
 *
 * @param {string} userId
 * @returns {Category[]}
 */
export const listCategories = async (userId) => {
  const categories = await Category.find({
    $or: [{ isSeeded: true }, { user_id: userId }],
  })
    .select("-__v")
    .lean();

  // Sort: seeded first, then user-created, both alphabetically within groups
  return categories.sort((a, b) => {
    if (a.isSeeded !== b.isSeeded) return a.isSeeded ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
};

/**
 * Create a new user-defined category.
 * Enforces max 7 active categories per user.
 * Prevents duplicate names within the user's own scope (case-insensitive check).
 *
 * @param {string} userId
 * @param {{ name: string }} data - Validated payload
 * @returns {Category}
 */
export const createCategory = async (userId, { name }) => {
  // 1. Enforce per-user limit (count active user-created categories only)
  const existingCount = await Category.countDocuments({ user_id: userId });
  if (existingCount >= USER_CATEGORY_LIMIT) {
    throw new ApiError(
      422,
      `Category limit reached. You can create a maximum of ${USER_CATEGORY_LIMIT} categories.`
    );
  }

  // 2. Case-insensitive duplicate check within user's own scope
  const duplicate = await Category.findOne({
    user_id: userId,
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
  });
  if (duplicate) {
    throw new ApiError(409, `You already have a category named "${duplicate.name}"`);
  }

  // 3. Create
  const category = await Category.create({
    name,
    user_id: userId,
    isSeeded: false,
  });

  return category;
};

/**
 * Update a user's own category name.
 * Blocks editing of seeded categories.
 *
 * @param {string} categoryId
 * @param {string} userId
 * @param {{ name: string }} data
 * @returns {Category}
 */
export const updateCategory = async (categoryId, userId, { name }) => {
  // 1. Fetch the category
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  // 2. Block edits on seeded categories
  if (category.isSeeded) {
    throw new ApiError(403, "Admin-seeded categories cannot be edited");
  }

  // 3. Ownership check
  if (String(category.user_id) !== String(userId)) {
    throw new ApiError(403, "You can only edit your own categories");
  }

  // 4. Case-insensitive duplicate check (exclude the current category itself)
  const duplicate = await Category.findOne({
    user_id: userId,
    _id: { $ne: categoryId },
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
  });
  if (duplicate) {
    throw new ApiError(409, `You already have a category named "${duplicate.name}"`);
  }

  // 5. Apply update
  category.name = name;
  await category.save();

  return category;
};

/**
 * Soft-delete a user's own category.
 * Blocks deletion of seeded categories.
 * Sets deleted_at instead of removing the document.
 *
 * @param {string} categoryId
 * @param {string} userId
 * @returns {Category}
 */
export const deleteCategory = async (categoryId, userId) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  // Block soft-delete on seeded categories
  if (category.isSeeded) {
    throw new ApiError(403, "Admin-seeded categories cannot be deleted");
  }

  // Ownership check
  if (String(category.user_id) !== String(userId)) {
    throw new ApiError(403, "You can only delete your own categories");
  }

  category.deleted_at = new Date();
  await category.save();

  return category;
};

/**
 * Get a single category by ID.
 * Visible to the owner or if it's a seeded category.
 *
 * @param {string} categoryId
 * @param {string} userId
 * @returns {Category}
 */
export const getCategoryById = async (categoryId, userId) => {
  const category = await Category.findOne({
    _id: categoryId,
    $or: [{ isSeeded: true }, { user_id: userId }],
  }).select("-__v");

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return category;
};



// ─── Helpers ──────────────────────────────────────────────────────────────────

// Escape special regex characters in user-provided strings
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
