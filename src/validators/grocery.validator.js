// src/validators/grocery.validator.js

import { z } from "zod";
import { UNIT_ENUM, PRIORITY_ENUM } from "../models/GroceryItem.model.js";

export const createGroceryItemSchema = z.object({
  name: z
    .string({ required_error: "Item name is required" })
    .trim()
    .min(1, "Name cannot be empty")
    .max(100, "Name cannot exceed 100 characters"),

  category_id: z
    .string({ required_error: "category_id is required" })
    .regex(/^[a-f\d]{24}$/i, "category_id must be a valid MongoDB ObjectId"),

  quantity: z
    .number({ required_error: "Quantity is required" })
    .positive("Quantity must be a positive number"),

  unit: z.enum(UNIT_ENUM, {
    errorMap: () => ({ message: `Unit must be one of: ${UNIT_ENUM.join(", ")}` }),
  }),

  purchased: z.boolean().optional().default(false),

  due_date: z.coerce.date().optional().nullable(),

  notes: z.string().trim().max(500).optional().nullable(),

  priority: z
    .enum(PRIORITY_ENUM, {
      errorMap: () => ({ message: `Priority must be one of: ${PRIORITY_ENUM.join(", ")}` }),
    })
    .optional()
    .default("medium"),
});


export const updateGroceryItemSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),

    category_id: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "category_id must be a valid MongoDB ObjectId")
      .optional(),

    quantity: z
      .number()
      .positive("Quantity must be a positive number")
      .optional(),

    unit: z
      .enum(UNIT_ENUM, {
        errorMap: () => ({
          message: `Unit must be one of: ${UNIT_ENUM.join(", ")}`,
        }),
      })
      .optional(),

    purchased: z.boolean().optional(),

    due_date: z.coerce.date().optional().nullable(),

    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .optional()
      .nullable(),

    priority: z
      .enum(PRIORITY_ENUM, {
        errorMap: () => ({
          message: `Priority must be one of: ${PRIORITY_ENUM.join(", ")}`,
        }),
      })
      .optional(),
  })
  .strict() // 🚨 reject unknown fields
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });