import { z } from "zod";

// Validation des données nécessaires à la création d'un utilisateur.
// Le tenantId n'est pas fourni par le client :
// il sera récupéré depuis le contexte d'authentification.
export const createUserSchema = z.object({
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

  // Le rôle est identifié par son UUID.
  // Son appartenance au tenant sera vérifiée dans le service.
  roleId: z.string().uuid(),
});

// Validation des données autorisées lors de la modification.
// Le mot de passe et le statut du compte sont gérés séparément.
export const updateUserSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must contain at least 2 characters")
    .max(100)
    .optional(),

  lastName: z
    .string()
    .trim()
    .min(2, "Last name must contain at least 2 characters")
    .max(100)
    .optional(),

  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255)
    .transform((value) => value.toLowerCase())
    .optional(),

  roleId: z
    .string()
    .uuid()
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided",
);

// Validation de l'identifiant utilisateur transmis dans l'URL.
export const userIdSchema = z.object({
  id: z.string().uuid(),
});

// Validation du statut d'activation d'un compte.
export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

// Validation des paramètres de pagination et de recherche.
// Les valeurs par défaut évitent de demander une liste illimitée.
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z
    .string()
    .trim()
    .max(100)
    .optional(),
});

// Types TypeScript déduits des schémas de validation.
export type CreateUserInput = z.infer<
  typeof createUserSchema
>;

export type UpdateUserInput = z.infer<
  typeof updateUserSchema
>;

export type UpdateUserStatusInput = z.infer<
  typeof updateUserStatusSchema
>;

export type ListUsersQuery = z.infer<
  typeof listUsersQuerySchema
>;