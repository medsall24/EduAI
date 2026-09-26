import { z } from "zod";

export const createModuleSchema = z.object({
  formationId: z.string().uuid("Invalid formation ID"),

  title: z
    .string()
    .trim()
    .min(3, "Title must contain at least 3 characters")
    .max(255, "Title must not exceed 255 characters"),

  description: z
    .string()
    .trim()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),

  position: z
    .number()
    .int("Position must be an integer")
    .positive("Position must be greater than 0"),

  isActive: z
    .boolean()
    .optional(),
});

export const updateModuleSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must contain at least 3 characters")
      .max(255, "Title must not exceed 255 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(5000, "Description must not exceed 5000 characters")
      .nullable()
      .optional(),

    position: z
      .number()
      .int("Position must be an integer")
      .positive("Position must be greater than 0")
      .optional(),

    isActive: z
      .boolean()
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    },
  );

export const moduleIdSchema = z.object({
  id: z.string().uuid("Invalid module ID"),
});

export const formationIdSchema = z.object({
  formationId: z.string().uuid("Invalid formation ID"),
});

export type CreateModuleInput = z.infer<
  typeof createModuleSchema
>;

export type UpdateModuleInput = z.infer<
  typeof updateModuleSchema
>;

