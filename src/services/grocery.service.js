// src/services/grocery.service.js
// Business logic for grocery items.
// Services own DB interactions — controllers stay thin.

import { GroceryItem } from "../models/GroceryItem.model.js";
import { Category } from "../models/Category.model.js";
import { ApiError } from "../utils/ApiError.js";
import mongoose from "mongoose";

/**
 * Create a new grocery item for a user.
 * Validates that the referenced category exists and belongs to the user
 * (or is a global category).
 *
 * @param {string} userId - Authenticated user's ID
 * @param {object} data   - Validated payload from Zod
 * @returns {GroceryItem}
 */
export const createGroceryItem = async (userId, data) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      name,
      category_id,
      quantity,
      unit,
      purchased,
      due_date,
      notes,
      priority,
    } = data;

    // 1️⃣ Validate Category Ownership
    const category = await Category.findOne({
      _id: category_id,
      $or: [
        { user_id: userId }, // user-owned category
        { isSeeded: true }, // global seeded category
      ],
    }).session(session);
    
    if (!category) {
      throw new ApiError(404, "Category not found or not accessible");
    }

    // 2️⃣ Optional: Prevent duplicate active items
    const existingItem = await GroceryItem.findOne({
      user_id: userId,
      name: name.trim().toLowerCase(),
      category_id,
      purchased: false,
      deleted_at: null,
    }).session(session);

    if (existingItem) {
      throw new ApiError(409, "Item already exists in this category");
    }

    // 3️⃣ Business Logic Handling
    const itemPayload = {
      user_id: userId,
      name: name.trim(),
      category_id,
      quantity,
      unit,
      purchased: purchased ?? false,
      due_date: due_date ?? null,
      notes: notes ?? null,
      priority: priority ?? "medium",
      purchased_date: purchased ? new Date() : null,
    };

    // 4️⃣ Create Item
    const item = await GroceryItem.create([itemPayload], { session });

    await session.commitTransaction();
    session.endSession();

    // 5️⃣ Return Clean Object
    return item[0].toObject();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * List grocery items for a user.
 */
export const getUserGroceryItems = async (userId, query) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    keyword,
    category_id,
    purchased,
    priority,
    startDate,
    endDate,
  } = query;

  // ─── Pagination Setup ────────────────────────────────────────────────
  const pageNumber = Math.max(parseInt(page, 10), 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10), 1), 100); // cap at 100
  const skip = (pageNumber - 1) * limitNumber;

  // ─── Base Query ──────────────────────────────────────────────────────
  const filter = {
    user_id: userId,
  };

  // ─── Filters ─────────────────────────────────────────────────────────

  if (category_id) {
    filter.category_id = category_id;
  }

  if (typeof purchased === "string") {
    filter.purchased = purchased === "true";
  }

  if (priority) {
    filter.priority = priority;
  }

  // Keyword Search (case-insensitive)
  if (keyword) {
    filter.name = { $regex: keyword, $options: "i" };
  }

  // Date Filtering (on createdAt OR due_date → design choice)
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.createdAt.$lte = new Date(endDate);
    }
  }

  // ─── Sorting ─────────────────────────────────────────────────────────
  const allowedSortFields = [
    "createdAt",
    "updatedAt",
    "due_date",
    "priority",
    "quantity",
  ];

  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const sortDirection = sortOrder === "asc" ? 1 : -1;

  const sort = {
    [sortField]: sortDirection,
  };

  // ─── Query Execution ─────────────────────────────────────────────────
  const [items, total] = await Promise.all([
    GroceryItem.find(filter).sort(sort).skip(skip).limit(limitNumber).lean(),

    GroceryItem.countDocuments(filter),
  ]);

  // ─── Response Shape ──────────────────────────────────────────────────
  return {
    items,
    pagination: {
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
      hasNextPage: pageNumber * limitNumber < total,
      hasPrevPage: pageNumber > 1,
    },
  };
};

/**
 * edit grocery items for a user.
 */
export const updateGroceryItem = async (userId, itemId, data) => {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new ApiError(400, "Invalid item ID");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1️⃣ Fetch existing item (ownership enforced)
    const existingItem = await GroceryItem.findOne({
      _id: itemId,
      user_id: userId,
    }).session(session);

    if (!existingItem) {
      throw new ApiError(404, "Grocery item not found");
    }

    // 2️⃣ Prevent empty update
    if (!data || Object.keys(data).length === 0) {
      throw new ApiError(400, "No update data provided");
    }

    const updatePayload = {};

    // ─── Allowed Fields Only ────────────────────────────────────────────
    const allowedFields = [
      "name",
      "category_id",
      "quantity",
      "unit",
      "purchased",
      "due_date",
      "notes",
      "priority",
    ];

    for (const key of allowedFields) {
      if (key in data) {
        updatePayload[key] = data[key];
      }
    }

    // 3️⃣ Category Ownership Check (if updating category)
    if (updatePayload.category_id) {
      const category = await Category.findOne({
        _id: updatePayload.category_id,
        user_id: userId,
      }).session(session);

      if (!category) {
        throw new ApiError(404, "Category not found or not accessible");
      }
    }

    // 4️⃣ Business Logic: purchased state transition
    if (typeof updatePayload.purchased === "boolean") {
      const wasPurchased = existingItem.purchased;
      const nowPurchased = updatePayload.purchased;

      if (!wasPurchased && nowPurchased) {
        updatePayload.purchased_date = new Date();
      }

      if (wasPurchased && !nowPurchased) {
        updatePayload.purchased_date = null;
      }
    }

    // 5️⃣ Normalize Fields
    if (updatePayload.name) {
      updatePayload.name = updatePayload.name.trim();
    }

    // 6️⃣ Perform Update
    const updatedItem = await GroceryItem.findOneAndUpdate(
      { _id: itemId, user_id: userId },
      { $set: updatePayload },
      {
        new: true,
        runValidators: true,
        session,
      },
    ).lean();

    await session.commitTransaction();
    session.endSession();

    return updatedItem;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 *  grocery service insight
 */
export const getGroceryInsights = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  const [stats] = await GroceryItem.aggregate([
    {
      $match: {
        user_id: userObjectId,
        deleted_at: null,
      },
    },

    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $eq: ["$purchased", true] }, 1, 0] },
              },
              pending: {
                $sum: { $cond: [{ $eq: ["$purchased", false] }, 1, 0] },
              },
              highPriority: {
                $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] },
              },
            },
          },
        ],

        // ─── Items by Category ────────────────────────
        byCategory: [
          {
            $group: {
              _id: "$category_id",
              count: { $sum: 1 },
            },
          },
          {
            $lookup: {
              from: "categories",
              localField: "_id",
              foreignField: "_id",
              as: "category",
            },
          },
          {
            $unwind: "$category",
          },
          {
            $project: {
              _id: 0,
              category_id: "$_id",
              name: "$category.name",
              count: 1,
            },
          },
        ],

        // ─── Overdue Items ────────────────────────────
        overdue: [
          {
            $match: {
              purchased: false,
              due_date: { $ne: null, $lt: now },
            },
          },
          {
            $count: "count",
          },
        ],
      },
    },
  ]);

  // ─── Normalize Response ───────────────────────────
  const overview = stats.overview[0] || {
    total: 0,
    completed: 0,
    pending: 0,
    highPriority: 0,
  };

  const overdue = stats.overdue[0]?.count || 0;

  return {
    overview: {
      ...overview,
      overdue,
    },
    byCategory: stats.byCategory,
  };
};

/**
 * Soft-delete a grocery item (sets deleted_at instead of removing from DB).
 */
export const softDeleteGroceryItem = async (userId, itemId) => {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new ApiError(400, "Invalid item ID");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1️⃣ Find item (INCLUDING deleted ones)
    const item = await GroceryItem.findOne(
      { _id: itemId, user_id: userId },
      null,
      { session, includeDeleted: true }, // bypass pre('find')
    );

    if (!item) {
      throw new ApiError(404, "Grocery item not found");
    }

    // 2️⃣ If already deleted → idempotent success
    if (item.deleted_at) {
      await session.commitTransaction();
      session.endSession();
      return { alreadyDeleted: true };
    }

    // 3️⃣ Soft delete
    item.deleted_at = new Date();
    await item.save({ session, validateBeforeSave: false });

    await session.commitTransaction();
    session.endSession();

    return { deleted: true };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
