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
    GroceryItem.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNumber)
      .populate("category_id", "name")
      .lean(),

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

// grocery bulk add

export const bulkCreateGroceryItems = async (userId, items) => {
  // 1. Extract all unique category IDs from the incoming items
  const categoryIds = [...new Set(items.map((item) => item.category_id))];

  // 2. Validate that all category IDs exist in DB and belong to this user (or are global)
  const existingCategories = await Category.find({
    _id: { $in: categoryIds },
    deleted_at: null,
  }).select("_id");

  const existingCategoryIds = new Set(
    existingCategories.map((cat) => cat._id.toString())
  );

  const invalidCategories = categoryIds.filter(
    (id) => !existingCategoryIds.has(id.toString())
  );

  if (invalidCategories.length > 0) {
    throw new ApiError(
      400,
      `Invalid or non-existent category IDs: ${invalidCategories.join(", ")}`
    );
  }

  // 3. Prepare documents for insertMany
  const now = new Date();
  const docs = items.map((item) => ({
    user_id: userId,
    name: item.name,
    category_id: item.category_id,
    quantity: item.quantity,
    unit: item.unit,
    purchased: item.purchased ?? false,
    due_date: item.due_date ?? null,
    purchased_date: null,
    notes: item.notes ?? null,
    priority: item.priority ?? "medium",
    deleted_at: null,
    createdAt: now,
    updatedAt: now,
  }));
  // 4. Bulk insert — ordered: false continues on error, collecting all failures
  let insertedDocs;
  try {
    insertedDocs = await GroceryItem.insertMany(docs, {
      ordered: false,      // don't abort on first error; attempt all
      rawResult: false,    // return inserted documents, not the raw MongoDB result
    });
  } catch (err) {
    // BulkWriteError: some inserts succeeded, some failed
    if (err.name === "MongoBulkWriteError") {
      const succeeded = err.insertedDocs ?? [];
      const writeErrors = err.writeErrors ?? [];

      return {
        total: items.length,
        inserted_count: succeeded.length,
        failed_count: writeErrors.length,
        inserted: succeeded,
        errors: writeErrors.map((e) => ({
          index: e.index,
          message: e.errmsg,
          item: items[e.index],
        })),
      };
    }

    // Unknown error — rethrow for global error handler
    throw new ApiError(500, "Bulk insert failed", err);
  }

  // 5. All inserts succeeded
  return {
    total: items.length,
    inserted_count: insertedDocs.length,
    failed_count: 0,
    inserted: insertedDocs,
    errors: [],
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
        $or: [
          { user_id: userId }, // user-owned category
          { isSeeded: true }, // global seeded category
        ],
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

export const getgroceryItemDetail = async (userId, itemId) => {
  // 1. Validate inputs
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new ApiError(400, "Invalid item ID");
  }

  // 2. Fetch item (ensure item belongs to user)
  const item = await GroceryItem.findOne({
    _id: itemId,
    user_id: userId,
  }).lean();

  // 3. Handle not found
  if (!item) {
    throw new ApiError(404, "Grocery item not found");
  }

  return item;
};


/**
 *  grocery service insight
 */
export const getGroceryInsight = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  console.log(userObjectId)

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