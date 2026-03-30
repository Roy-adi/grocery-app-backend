// src/app.js
// Express app factory — separated from server entry point so it can be
// imported cleanly in tests without starting the HTTP server.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";

import { env } from "./config/env.js";
// import { generalLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { logger } from "./utils/logger.js";

import routes  from "./routes/index.js";


const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────

// Sets secure HTTP headers (XSS, clickjacking, sniffing protections)
app.use(helmet());

// CORS — allow web & mobile clients
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman)
      if (!origin || env.cors.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true, // Required for cookies to be sent cross-origin
  })
);

// Prevent NoSQL injection (sanitizes $ and . in req.body, params, query)
app.use(mongoSanitize());

// Global IP-based rate limiter
// app.use(generalLimiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10kb" }));        // Reject oversized payloads
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// ─── Request Logger (dev) ─────────────────────────────────────────────────────

if (!env.isProd) {
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/v1", routes);

// Health check — useful for Render uptime monitoring
app.get("/health", (_req, res) => {
  res.json({ success: true, message: "Server is running", env: env.NODE_ENV });
});

// 404 handler — catches any unregistered routes
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Must be registered AFTER all routes
app.use(errorHandler);

export default app;
