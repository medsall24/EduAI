
import { z } from "zod";

// Types de contenus pédagogiques générés par l'IA.
export const trainerDraftTypeSchema = z.enum([
  "QUIZ",
  "EXERCISE",
  "LESSON_CONTENT",
]);

// Statuts possibles d'un brouillon.
export const trainerDraftStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

// Génération d'un contenu pédagogique.
export const generateTrainerContentSchema = z
  .object({
    formationId: z.string().uuid(),
    lessonId: z.string().uuid().optional(),
    type: trainerDraftTypeSchema,
    instructions: z
      .string()
      .trim()
      .min(10, "Les consignes doivent contenir au moins 10 caractères.")
      .max(5000, "Les consignes ne doivent pas dépasser 5000 caractères."),
    difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("INTERMEDIATE"),
    questionCount: z.number().int().min(1).max(20).optional(),
  })
  .strict();

// Identifiant d'un brouillon.
export const trainerDraftIdSchema = z.object({
  draftId: z.string().uuid(),
});

// Modification d'un brouillon.
export const updateTrainerDraftSchema = z
  .object({
    content: z
      .record(z.string(), z.unknown())
      .refine(
        (value) => Object.keys(value).length > 0,
        "Le contenu ne peut pas être vide.",
      )
      .optional(),
  })
  .strict()
  .refine((data) => data.content !== undefined, {
    message: "Aucune modification fournie.",
  });

// Décision humaine sur un brouillon.
export const reviewTrainerDraftSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
  })
  .strict();

// Types TypeScript inférés.
export type GenerateTrainerContentInput = z.infer<
  typeof generateTrainerContentSchema
>;

export type UpdateTrainerDraftInput = z.infer<
  typeof updateTrainerDraftSchema
>;

export type ReviewTrainerDraftInput = z.infer<
  typeof reviewTrainerDraftSchema
>;

export type TrainerDraftType = z.infer<
  typeof trainerDraftTypeSchema
>;

export type TrainerDraftStatus = z.infer<
  typeof trainerDraftStatusSchema
>;


export const listTrainerDraftsSchema = z
  .object({
    formationId: z.string().uuid().optional(),
    type: trainerDraftTypeSchema.optional(),
    status: trainerDraftStatusSchema.optional(),
  })
  .strict();

export type ListTrainerDraftsInput = z.infer<
  typeof listTrainerDraftsSchema
>;
