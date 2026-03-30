// src/utils/asyncHandler.js
// Wraps async route handlers to forward errors to Express error middleware.
// Usage: router.post("/route", asyncHandler(controller))

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
