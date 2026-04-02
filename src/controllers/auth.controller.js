// src/controllers/auth.controller.js
// Controllers are thin: extract data → call service → send response.
// No business logic here.

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import * as authService from "../services/auth.service.js";
import {
  refreshTokenCookieOptions,
  accessTokenCookieOptions,
} from "../utils/token.js";

// ─── POST /api/v1/auth/signup ─────────────────────────────────────────────────
export const signup = asyncHandler(async (req, res) => {
  // req.body already validated & coerced by validate() middleware
  const { user, accessToken, refreshToken } = await authService.registerUser(
    req.body,
  );

  setAuthCookies(res, { accessToken, refreshToken });

  return new ApiResponse(
    201,
    { user, accessToken, refreshToken },
    "Account created successfully",
  ).send(res);
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.loginUser(
    req.body,
  );

  setAuthCookies(res, { accessToken, refreshToken });

  return new ApiResponse(
    200,
    { user, accessToken, refreshToken },
    "Login successful",
  ).send(res);
});

/**
 * GOOGLE AUTH
 * (frontend sends verified user info from Firebase/Clerk)
 */
export const googleLogin = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.googleAuth(
    req.body,
  );

  setAuthCookies(res, { accessToken, refreshToken });

  return new ApiResponse(
    200,
    { user, accessToken, refreshToken },
    "Google authentication successful",
  ).send(res);
});

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user.userId);

  clearAuthCookies(res);

  return new ApiResponse(200, null, "Logged out successfully").send(res);
});

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
export const refresh = asyncHandler(async (req, res) => {
  console.log(req.body)
  // 1. From cookies (web)
  let incomingRefreshToken = req.cookies?.refreshToken;

  // 2. From body (mobile)
  if (!incomingRefreshToken) {
    incomingRefreshToken = req.body?.refreshToken;
  }

  // 3. Optional: from Authorization header
  if (
    !incomingRefreshToken &&
    req.headers.authorization?.startsWith("Bearer ")
  ) {
    incomingRefreshToken = req.headers.authorization.split(" ")[1];
  }

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  const { accessToken, refreshToken, user } =
    await authService.refreshTokens(incomingRefreshToken);

  // Only set cookies for web
  if (req.cookies?.refreshToken) {
    setAuthCookies(res, { accessToken, refreshToken });
  }

  return new ApiResponse(
    200,
    { accessToken, refreshToken, user },
    "Tokens refreshed",
  ).send(res);
});

export const getMe = asyncHandler(async (req, res) => {
  // req.user comes from auth middleware (JWT decoded)
  const user = await authService.getCurrentUser(req.user.userId);

  return new ApiResponse(200, user, "User fetched successfully").send(res);
});

// update profile
export const updateprofile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const { name, password } = req.body;

  const updatedUser = await authService.editProfileService(userId, {
    name,
    password,
  });

  return new ApiResponse(200, { updatedUser }, "user updated").send(res);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie("accessToken", accessToken, accessTokenCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
};

const clearAuthCookies = (res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
};
