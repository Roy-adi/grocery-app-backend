// src/middlewares/auth.js
// Protects routes by verifying the JWT access token.
// Token is read from HTTP-only cookie first, then Authorization header (for mobile clients).

import { verifyAccessToken } from "../utils/token.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/User.model.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  // 1. Extract token — cookie (web) or Bearer header (mobile/Expo)
  const token =
    req.cookies?.accessToken ||
    req.headers.authorization?.replace("Bearer ", "");


  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  // 2. Verify and decode
  const decoded = verifyAccessToken(token);

  // 3. Confirm the user still exists (handles deleted accounts)
  const user = await User.findById(decoded.userId).select("_id role");
  if (!user) {
    throw new ApiError(401, "User not found");
  }

  // 4. Attach to request for downstream use
  req.user = { userId: user._id, role: user.role };
  next();
});

/**
 * Role-based access guard.
 * Usage: router.get("/admin-route", authenticate, authorize("admin"), controller)
 */
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    throw new ApiError(403, "Access denied: insufficient permissions");
  }
  next();
};
