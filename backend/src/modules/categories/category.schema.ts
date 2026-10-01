import { z } from "zod";

// Schéma de validation utilisé lors de la création d'une catégorie.
export const createCategorySchema = z.object({
  // Nom de la catégorie.
  // Il est nettoyé avec trim() et doit contenir entre 2 et 255 caractères.
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(255, "Name must not exceed 255 characters"),

  // Slug utilisé comme identifiant textuel de la catégorie.
  // Le format impose des lettres minuscules, chiffres et tirets.
  slug: z
    .string()
    .trim()
    .min(2, "Slug must contain at least 2 characters")
    .max(255, "Slug must not exceed 255 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers and hyphens",
    ),

  // Description facultative de la catégorie.
  description: z
    .string()
    .trim()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),

  // Permet de créer directement une catégorie active ou inactive.
  // La valeur par défaut est appliquée dans le service.
  isActive: z.boolean().optional(),
});

// Schéma de validation utilisé lors de la modification d'une catégorie.
// Tous les champs sont facultatifs, mais au moins un champ doit être fourni.
export const updateCategorySchema = z
  .object({
    // Nouveau nom éventuel de la catégorie.
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters")
      .max(255, "Name must not exceed 255 characters")
      .optional(),

    // Nouveau slug éventuel de la catégorie.
    slug: z
      .string()
      .trim()
      .min(2, "Slug must contain at least 2 characters")
      .max(255, "Slug must not exceed 255 characters")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain only lowercase letters, numbers and hyphens",
      )
      .optional(),

    // Une valeur null permet explicitement de supprimer la description existante.
    description: z
      .string()
      .trim()
      .max(5000, "Description must not exceed 5000 characters")
      .nullable()
      .optional(),

    // Permet d'activer ou de désactiver la catégorie.
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      // Empêche l'envoi d'un objet de modification vide.
      message: "At least one field must be provided",
    },
  );

// Schéma utilisé pour valider l'identifiant d'une catégorie
// reçu depuis les paramètres de l'URL.
export const categoryIdSchema = z.object({
  id: z.string().uuid("Invalid category ID"),
});

// Type TypeScript correspondant aux données de création.
export type CreateCategoryInput = z.infer<
  typeof createCategorySchema
>;

// Type TypeScript correspondant aux données de modification.
export type UpdateCategoryInput = z.infer<
  typeof updateCategorySchema
>;