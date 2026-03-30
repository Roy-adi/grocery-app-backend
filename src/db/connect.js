// src/db/connect.js
// Handles MongoDB connection with retry logic and proper event listeners.

import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongo.uri, {
      // These are best-practice options for Atlas
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Retrying...");
    });

    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB error: ${err.message}`);
    });
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1); // Exit so process manager (Render) restarts the service
  }
};
