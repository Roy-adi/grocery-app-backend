// src/utils/logger.js
// Centralized logging via Winston.
// In production → JSON format (easy to parse in log aggregators).
// In development → colored, human-readable console output.

import winston from "winston";
import { env } from "../config/env.js";

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: env.isProd ? "warn" : "debug",
  format: env.isProd ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    // Add file transports or external log services here for production
    // e.g., new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  ],
});
