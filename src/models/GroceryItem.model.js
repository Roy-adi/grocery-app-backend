// src/models/GroceryItem.model.js

import mongoose from "mongoose";

const UNIT_ENUM = ["kg", "gram", "litre", "ml", "packet", "piece", "dozen", "box", "bottle", "can"];
const PRIORITY_ENUM = ["low", "medium", "high"];

const groceryItemSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "user_id is required"],
      index: true,
    },

    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [100, "Item name cannot exceed 100 characters"],
    },

    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
    },

    unit: {
      type: String,
      enum: {
        values: UNIT_ENUM,
        message: `Unit must be one of: ${UNIT_ENUM.join(", ")}`,
      },
      required: [true, "Unit is required"],
    },

    purchased: {
      type: Boolean,
      default: false,
    },

    due_date: {
      type: Date,
      default: null,
    },

    purchased_date: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
      default: null,
    },

    priority: {
      type: String,
      enum: {
        values: PRIORITY_ENUM,
        message: `Priority must be one of: ${PRIORITY_ENUM.join(", ")}`,
      },
      default: "medium",
    },

    // Soft delete: null means active, a Date means deleted
    deleted_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Most common query: active items for a user, sorted by priority
groceryItemSchema.index({ user_id: 1, deleted_at: 1, priority: -1 });

// ─── Query Helpers ────────────────────────────────────────────────────────────

/**
 * By default, exclude soft-deleted items.
 * Services can opt-in with: GroceryItem.findWithDeleted()
 */
groceryItemSchema.pre(/^find/, function (next) {
  // Only apply if the query doesn't explicitly include deleted items
  if (!this.getOptions().includeDeleted) {
    this.where({ deleted_at: null });
  }
  next();
});

export const GroceryItem = mongoose.model("GroceryItem", groceryItemSchema);
export { UNIT_ENUM, PRIORITY_ENUM };
