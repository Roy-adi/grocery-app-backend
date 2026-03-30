// src/utils/token.js
// Pure functions for signing and verifying JWTs.
// Keeps JWT logic out of controllers/services.

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

/**
 * Signs a short-lived access token.
 * @param {Object} payload - Data to embed (userId, role)
 */
export const signAccessToken = (payload) => {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry,
  });
};

/**
 * Signs a long-lived refresh token.
 * @param {Object} payload - Minimal data (userId only recommended)
 */
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiry,
  });
};

/**
 * Verifies an access token.
 * @throws {ApiError} 401 if invalid or expired
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.jwt.accessSecret);
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }
};

/**
 * Verifies a refresh token.
 * @throws {ApiError} 401 if invalid or expired
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.jwt.refreshSecret);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
};

/**
 * Cookie options for the refresh token.
 * HTTP-only → not accessible via JS (XSS protection).
 */
export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

/**
 * Cookie options for the access token.
 * Shorter-lived than refresh token.
 */
export const accessTokenCookieOptions = {
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  maxAge: 15 * 60 * 1000, // 15 minutes in ms
};
