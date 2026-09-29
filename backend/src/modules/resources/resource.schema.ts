import { z } from "zod";

/**
 * Types de ressources autorisés par le modèle Prisma Resource.
 */
const resourceTypeSchema = z.enum([
  "PDF",
  "DOCUMENT",
  "IMAGE",
  "VIDEO",
  "LINK",
  "OTHER",
]);

/**
 * Schéma de validation lors de la création d'une ressource.
 */
export const createResourceSchema = z.object({
  // Leçon à laquelle la ressource appartient.
  lessonId: z.string().uuid("Invalid lesson ID"),

  // Titre de la ressource.
  title: z
    .string()
    .trim()
    .min(3, "Title must contain at least 3 characters")
    .max(255, "Title must not exceed 255 characters"),

  // Description facultative de la ressource.
  description: z
    .string()
    .trim()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),

  // Type de ressource : PDF, document, image, vidéo, lien ou autre.
  type: resourceTypeSchema,

  // URL permettant d'accéder à la ressource.
  url: z
    .string()
    .trim()
    .url("Invalid resource URL"),

  // Nom du fichier lorsque la ressource correspond à un fichier.
  fileName: z
    .string()
    .trim()
    .max(255, "File name must not exceed 255 characters")
    .optional(),

  // Type MIME du fichier, par exemple application/pdf.
  mimeType: z
    .string()
    .trim()
    .max(255, "MIME type must not exceed 255 characters")
    .optional(),

  // Taille du fichier en octets.
  fileSize: z
    .number()
    .int("File size must be an integer")
    .positive("File size must be greater than 0")
    .optional(),

  // Position de la ressource dans la leçon.
  position: z
    .number()
    .int("Position must be an integer")
    .positive("Position must be greater than 0"),

  // Indique si l'apprenant peut télécharger la ressource.
  isDownloadable: z.boolean().optional(),

  // Permet d'activer ou désactiver la ressource.
  isActive: z.boolean().optional(),
});

/**
 * Schéma de validation lors de la modification d'une ressource.
 *
 * Tous les champs sont facultatifs, mais au moins un champ
 * doit être fourni pour effectuer une modification.
 */
export const updateResourceSchema = z
  .object({
    // Nouveau titre de la ressource.
    title: z
      .string()
      .trim()
      .min(3, "Title must contain at least 3 characters")
      .max(255, "Title must not exceed 255 characters")
      .optional(),

    // Nouvelle description. null permet de supprimer la description.
    description: z
      .string()
      .trim()
      .max(5000, "Description must not exceed 5000 characters")
      .nullable()
      .optional(),

    // Nouveau type de ressource.
    type: resourceTypeSchema.optional(),

    // Nouvelle URL de la ressource.
    url: z
      .string()
      .trim()
      .url("Invalid resource URL")
      .optional(),

    // Nouveau nom de fichier.
    fileName: z
      .string()
      .trim()
      .max(255, "File name must not exceed 255 characters")
      .nullable()
      .optional(),

    // Nouveau type MIME.
    mimeType: z
      .string()
      .trim()
      .max(255, "MIME type must not exceed 255 characters")
      .nullable()
      .optional(),

    // Nouvelle taille du fichier.
    fileSize: z
      .number()
      .int("File size must be an integer")
      .positive("File size must be greater than 0")
      .nullable()
      .optional(),

    // Nouvelle position dans la leçon.
    position: z
      .number()
      .int("Position must be an integer")
      .positive("Position must be greater than 0")
      .optional(),

    // Modification de l'autorisation de téléchargement.
    isDownloadable: z.boolean().optional(),

    // Activation ou désactivation de la ressource.
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Validation de l'identifiant d'une ressource.
 */
export const resourceIdSchema = z.object({
  id: z.string().uuid("Invalid resource ID"),
});

/**
 * Validation de l'identifiant d'une leçon.
 *
 * Utilisé notamment pour lister les ressources
 * appartenant à une leçon donnée.
 */
export const lessonIdSchema = z.object({
  lessonId: z.string().uuid("Invalid lesson ID"),
});