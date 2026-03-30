// src/middlewares/errorHandler.js
// Global Express error middleware — must have 4 parameters.
// Catches all errors forwarded via next(err).

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  // Log full error (with stack in dev)
  logger.error(err.stack || err.message);

  // ── Mongoose Validation Error ──────────────────────────────────────────────
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // ── Mongoose Duplicate Key ─────────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
      errors: [{ field, message: `${field} already exists` }],
    });
  }

  // ── JWT Errors (not caught in middleware) ──────────────────────────────────
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  // ── Our ApiError ───────────────────────────────────────────────────────────
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors?.length ? err.errors : undefined,
    });
  }

  // ── Unexpected / Programmer Errors ─────────────────────────────────────────
  // Don't leak internal details to client in production
  return res.status(500).json({
    success: false,
    message: env.isProd ? "Internal server error" : err.message,
  });
};
