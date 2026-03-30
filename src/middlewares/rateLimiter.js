// src/middlewares/rateLimiter.js

import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";


/**
 * Generate unique key based on IP + User ID (if available)
 */
const keyGenerator = (req) => {
  const ip = req.ip;

  // If user is authenticated, use user ID
  if (req.user && req.user.id) {
    return `${req.user.id}-${ip}`;
  }

  // fallback to IP
  return ip;
};

/**
 * General API rate limiter — applied globally.
 */
export const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});




/**
 * Strict limiter for login endpoint to prevent brute-force attacks.
 */
export const loginLimiter = rateLimit({
  windowMs: env.loginRateLimit.windowMs,
  max: env.loginRateLimit.max,

  // DO NOT use userId here (user not authenticated yet)
  keyGenerator: (req) => req.ip,

  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 10 minutes.",
  },
});
