// src/config/env.js
// Central place to load & validate environment variables at startup.
// Throws early if required vars are missing → no silent runtime failures.

import dotenv from "dotenv";
dotenv.config();

const required = [
  "MONGODB_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT, 10) || 5000,
  isProd: process.env.NODE_ENV === "production",

  mongo: {
    uri: process.env.MONGODB_URI,
  },

  jwt: {
    accessSecret: process.env.ACCESS_TOKEN_SECRET,
    refreshSecret: process.env.REFRESH_TOKEN_SECRET,
    accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  },

  cookie: {
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: process.env.COOKIE_SAME_SITE || "strict",
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  loginRateLimit: {
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10) || 10 * 60 * 1000,
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 10,
  },

  cors: {
    allowedOrigins: [
      process.env.CLIENT_WEB_URL || "http://localhost:5173",
      process.env.CLIENT_WEB_URL || "http://localhost:5174",
      process.env.CLIENT_WEB_URL || "http://localhost:3000",
      process.env.CLIENT_MOBILE_URL || "exp://localhost:8081",
    ],
  },
};
