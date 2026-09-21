import { z } from "zod";

// Données acceptées lors de la création d'un compte utilisateur.
// Le tenantId n'est volontairement pas fourni par le client.
// Le contexte du tenant sera déterminé par le backend.
export const registerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must contain at least 2 characters")
    .max(100),

  lastName: z
    .string()
    .trim()
    .min(2, "Last name must contain at least 2 characters")
    .max(100),

  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255)
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(128),

  roleName: z.enum([
    "TENANT_ADMIN",
    "FORMATEUR",
    "APPRENANT",
  ]),
});

export type RegisterInput = z.infer<
  typeof registerSchema
>;


// Données acceptées lors de l'authentification d'un utilisateur.
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255)
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(1, "Password is required")
    .max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;


// Données acceptées lors du renouvellement d'un access token.
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, "Refresh token is required"),
});

export type RefreshTokenInput = z.infer<
  typeof refreshTokenSchema
>;