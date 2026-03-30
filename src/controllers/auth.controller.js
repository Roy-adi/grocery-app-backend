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
  const { user, accessToken, refreshToken } = await authService.registerUser(req.body);

  setAuthCookies(res, { accessToken, refreshToken });

  return new ApiResponse(201, { user, accessToken }, "Account created successfully").send(res);
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.loginUser(req.body);

  setAuthCookies(res, { accessToken, refreshToken });

  return new ApiResponse(200, { user, accessToken }, "Login successful").send(res);
});

/**
 * GOOGLE AUTH
 * (frontend sends verified user info from Firebase/Clerk)
 */
export const googleLogin = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } =
    await authService.googleAuth(req.body);

  setAuthCookies(res, { accessToken, refreshToken });

  return new ApiResponse(
    200,
    { user, accessToken },
    "Google authentication successful"
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
  // Accept from cookie (web) or body (mobile)
  const incomingRefreshToken = req.cookies?.refreshToken 

  const { accessToken, refreshToken } = await authService.refreshTokens(
    incomingRefreshToken
  );

  setAuthCookies(res, { accessToken, refreshToken });

  return new ApiResponse(200, { accessToken }, "Tokens refreshed").send(res);
});


export const getMe = asyncHandler(async (req, res) => {
  // req.user comes from auth middleware (JWT decoded)
  const user = await authService.getCurrentUser(req.user.userId);

  return new ApiResponse(200, user, "User fetched successfully").send(res);
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
