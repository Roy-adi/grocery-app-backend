// src/validators/category.validator.js


import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string({ required_error: "Category name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),
});

// PATCH — name is the only user-editable field
export const updateCategorySchema = z.object({
  name: z
    .string({ required_error: "Category name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),
});

// Admin seed — supports bulk insert; each item must have a name
export const seedCategoriesSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z
          .string({ required_error: "Each category must have a name" })
          .trim()
          .min(2)
          .max(50),
      })
    )
    .min(1, "Provide at least one category to seed")
    .max(50, "Cannot seed more than 50 categories at once"),
});
