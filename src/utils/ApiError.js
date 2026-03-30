// src/utils/ApiError.js
// Custom error class that carries HTTP status codes.
// Caught by the global error middleware → consistent error shape.

export class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors; // Validation field errors, etc.
    this.isOperational = true; // Distinguish from unexpected programmer errors

    Error.captureStackTrace(this, this.constructor);
  }
}
