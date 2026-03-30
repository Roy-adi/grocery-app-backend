// src/models/Category.model.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    isSeeded: {
      type: Boolean,
      default: false,
      index: true,
    },

    deleted_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Unique name per scope:

categorySchema.index(
  { name: 1, user_id: 1, isSeeded: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted_at: null },
  },
);

// ─── Pre-find Hook ────────────────────────────────────────────────────────────
// Exclude soft-deleted categories by default.
// Opt-in: Category.find().setOptions({ includeDeleted: true })
categorySchema.pre(/^find/, function (next) {
  if (!this.getOptions().includeDeleted) {
    this.where({ deleted_at: null });
  }
  next();
});

export const Category = mongoose.model("Category", categorySchema);
