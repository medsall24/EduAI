import { z } from "zod";

export const createEnrollmentSchema = z.object({
  userId: z.string().uuid(),
  formationId: z.string().uuid(),
});

export type CreateEnrollmentInput = z.infer<
  typeof createEnrollmentSchema
>;