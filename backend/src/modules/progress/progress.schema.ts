import { z } from "zod";

/**
 * Schéma de validation pour la mise à jour
 * de la progression d'un apprenant.
 *
 * - lessonId : identifiant de la leçon concernée.
 * - isCompleted : indique si la leçon est terminée.
 */
export const updateProgressSchema = z.object({
  lessonId: z.string().uuid(),
  isCompleted: z.boolean(),
});

/**
 * Type TypeScript déduit automatiquement
 * du schéma Zod ci-dessus.
 */
export type UpdateProgressInput = z.infer<
  typeof updateProgressSchema
>;