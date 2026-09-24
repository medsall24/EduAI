import { z } from "zod";

export const createFormationSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  formateurId: z.string().uuid("Invalid formateur ID"),
  title: z
    .string()
    .trim()
    .min(3, "Title must contain at least 3 characters")
    .max(255, "Title must not exceed 255 characters"),
  slug: z
    .string()
    .trim()
    .min(3, "Slug must contain at least 3 characters")
    .max(255, "Slug must not exceed 255 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers and hyphens",
    ),
  description: z
    .string()
    .trim()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),
  thumbnailUrl: z
    .string()
    .trim()
    .url("Invalid thumbnail URL")
    .optional(),
});

export const updateFormationSchema = z
  .object({
    categoryId: z.string().uuid("Invalid category ID").optional(),
    formateurId: z.string().uuid("Invalid formateur ID").optional(),
    title: z
      .string()
      .trim()
      .min(3, "Title must contain at least 3 characters")
      .max(255, "Title must not exceed 255 characters")
      .optional(),
    slug: z
      .string()
      .trim()
      .min(3, "Slug must contain at least 3 characters")
      .max(255, "Slug must not exceed 255 characters")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain only lowercase letters, numbers and hyphens",
      )
      .optional(),
    description: z
      .string()
      .trim()
      .max(5000, "Description must not exceed 5000 characters")
      .optional(),
    thumbnailUrl: z
      .string()
      .trim()
      .url("Invalid thumbnail URL")
      .nullable()
      .optional(),
    status: z
      .enum(["DRAFT", "PUBLISHED", "ARCHIVED"])
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    },
  );

export const formationIdSchema = z.object({
  id: z.string().uuid("Invalid formation ID"),
});

export type CreateFormationInput = z.infer<
  typeof createFormationSchema
>;

export type UpdateFormationInput = z.infer<
  typeof updateFormationSchema
>;