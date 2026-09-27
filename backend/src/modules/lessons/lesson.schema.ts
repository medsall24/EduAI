import { z } from "zod";

const lessonTypeSchema = z.enum(["TEXT", "VIDEO", "DOCUMENT", "MIXED"]);

export const createLessonSchema = z.object({
  moduleId: z.string().uuid("Invalid module ID"),
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
  type: lessonTypeSchema,
  content: z
    .string()
    .trim()
    .optional(),
  videoUrl: z
    .string()
    .trim()
    .url("Invalid video URL")
    .optional(),
  duration: z
    .number()
    .int("Duration must be an integer")
    .positive("Duration must be greater than 0")
    .optional(),
  position: z
    .number()
    .int("Position must be an integer")
    .positive("Position must be greater than 0"),
  isPreview: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateLessonSchema = z
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
    type: lessonTypeSchema.optional(),
    content: z.string().trim().nullable().optional(),
    videoUrl: z
      .string()
      .trim()
      .url("Invalid video URL")
      .nullable()
      .optional(),
    duration: z
      .number()
      .int("Duration must be an integer")
      .positive("Duration must be greater than 0")
      .nullable()
      .optional(),
    position: z
      .number()
      .int("Position must be an integer")
      .positive("Position must be greater than 0")
      .optional(),
    isPreview: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const lessonIdSchema = z.object({
  id: z.string().uuid("Invalid lesson ID"),
});

export const moduleIdSchema = z.object({
  moduleId: z.string().uuid("Invalid module ID"),
});
