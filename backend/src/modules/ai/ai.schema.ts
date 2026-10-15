
import { z } from "zod";

export const createConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Le titre ne peut pas être vide.")
    .max(255, "Le titre ne doit pas dépasser 255 caractères.")
    .optional(),
});

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Le message ne peut pas être vide.")
    .max(10_000, "Le message ne doit pas dépasser 10 000 caractères."),
});

export const conversationIdSchema = z.object({
  conversationId: z.string().uuid("Identifiant de conversation invalide."),
});


export const updateConversationSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Le titre ne peut pas être vide.")
      .max(255, "Le titre ne doit pas dépasser 255 caractères.")
      .optional(),
    isArchived: z.boolean().optional(),
  })
  .refine(
    (data) => data.title !== undefined || data.isArchived !== undefined,
    {
      message: "Au moins un champ doit être fourni.",
    },
  );


export type CreateConversationInput = z.infer<
  typeof createConversationSchema
>;

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export type UpdateConversationInput = z.infer<
  typeof updateConversationSchema
>;
