// src/server.js
// Entry point — connects to DB then starts the HTTP server.
// Separated from app.js so the Express app can be tested independently.

import app from "./app.js";
import { connectDB } from "./db/connect.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";



const start = async () => {
  // 1. Connect to MongoDB (exits process on failure)
  await connectDB();

  // 2. Start HTTP server
const server = app.listen(env.PORT, "0.0.0.0", () => {
  logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
});

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────
  // Lets in-flight requests finish before closing on SIGTERM (Render sends this).

  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });

    // Force exit if graceful shutdown takes > 10s
    setTimeout(() => {
      logger.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Catch unhandled promise rejections (e.g., forgotten await)
  process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
    shutdown("unhandledRejection");
  });
};

start();
