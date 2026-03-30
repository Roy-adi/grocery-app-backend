// src/middlewares/validate.js
// Generic Zod validation middleware.
// Usage: router.post("/route", validate(myZodSchema), controller)
// On failure → 422 with field-level errors.

import { ApiError } from "../utils/ApiError.js";

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    // Map Zod issues to { field, message } pairs
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return next(new ApiError(422, "Validation failed", errors));
  }

  // Replace req.body with the parsed & coerced data
  req.body = result.data;
  next();
};
