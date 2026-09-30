import { z } from "zod";

// Validation des données nécessaires à la création d'une inscription.
export const createEnrollmentSchema = z.object({
  userId: z.string().uuid(),
  formationId: z.string().uuid(),
});

// Validation de l'identifiant d'une inscription.
export const enrollmentIdSchema = z.object({
  id: z.string().uuid(),
});

// Validation des statuts autorisés lors de la modification
// d'une inscription.
export const updateEnrollmentSchema = z.object({
  status: z.enum([
    "ACTIVE",
    "COMPLETED",
    "CANCELLED",
  ]),
});

// Type correspondant aux données validées pour la création.
export type CreateEnrollmentInput = z.infer<
  typeof createEnrollmentSchema
>;

// Type correspondant aux données validées pour la modification.
export type UpdateEnrollmentInput = z.infer<
  typeof updateEnrollmentSchema
>;
