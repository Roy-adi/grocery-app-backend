// src/models/User.model.js

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [60, "Name cannot exceed 60 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
      index: true, // Indexed for fast lookups on login
    },

    authProviders: {
      type: [String],
      enum: ["local", "google"],
      default: ["local"],
    },

    password: {
      type: String,
      minlength: [6, "Password must be at least 8 characters"],
      select: false,
      required: function () {
       return this.authProviders.includes("local");
      },
    },

    googleId: {
      type: String,
      sparse: true,
    },

    avatar: {
      type: String,
      default: null, // URL to avatar image
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    refreshTokens: [
      {
        token: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Optional: lock account after repeated failed logins
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// ─── Pre-save Hook: Hash password before saving ──────────────────────────────
userSchema.pre("save", async function (next) {
  // Only hash if password was modified (avoids re-hashing on unrelated updates)
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Compare a plaintext password against the stored hash.
 */
userSchema.methods.isPasswordCorrect = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check if the account is currently locked.
 */
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

/**
 * Increment failed login attempts. Lock after 5 failures for 15 minutes.
 */
userSchema.methods.incrementLoginAttempts = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME_MS = 15 * 60 * 1000;

  this.loginAttempts += 1;
  if (this.loginAttempts >= MAX_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
  }
  await this.save({ validateBeforeSave: false });
};

/**
 * Reset login attempts after a successful login.
 */
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  await this.save({ validateBeforeSave: false });
};

export const User = mongoose.model("User", userSchema);
