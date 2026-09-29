import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";

/**
 * Contexte du tenant fourni par le middleware d'authentification.
 *
 * Le tenantId est obligatoire pour les opérations classiques.
 * Le SUPER_ADMIN pourra éventuellement fonctionner avec tenantId = null.
 */
interface TenantContext {
  tenantId: string | null;
}

/**
 * Vérifie que le contexte contient bien un tenant.
 *
 * Les opérations Resource sont volontairement limitées
 * au tenant de l'utilisateur connecté.
 */
const ensureTenantContext = (
  context: TenantContext,
): string => {
  if (!context.tenantId) {
    throw new AppError(
      403,
      "Tenant context is required",
    );
  }

  return context.tenantId;
};

/**
 * Vérifie qu'une leçon appartient bien au tenant courant.
 *
 * Cette vérification est essentielle pour empêcher un utilisateur
 * d'un tenant d'ajouter une ressource à une leçon d'un autre tenant.
 */
const ensureLessonBelongsToTenant = async (
  lessonId: string,
  tenantId: string,
) => {
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      tenantId,
    },
  });

  if (!lesson) {
    throw new AppError(
      400,
      "Lesson does not belong to the current tenant",
    );
  }

  return lesson;
};

/**
 * Vérifie qu'une position est disponible dans une leçon.
 *
 * Deux ressources d'une même leçon et d'un même tenant
 * ne peuvent pas avoir la même position.
 */
const ensurePositionIsAvailable = async (
  tenantId: string,
  lessonId: string,
  position: number,
  excludedResourceId?: string,
) => {
  const existingResource =
    await prisma.resource.findFirst({
      where: {
        tenantId,
        lessonId,
        position,

        // Lors d'une modification, on exclut la ressource actuelle.
        ...(excludedResourceId
          ? {
              id: {
                not: excludedResourceId,
              },
            }
          : {}),
      },
    });

  if (existingResource) {
    throw new AppError(
      409,
      "A resource with this position already exists in this lesson",
    );
  }
};

/**
 * Crée une nouvelle ressource.
 */
export const createResource = async (
  data: {
    lessonId: string;
    title: string;
    description?: string;
    type:
      | "PDF"
      | "DOCUMENT"
      | "IMAGE"
      | "VIDEO"
      | "LINK"
      | "OTHER";
    url: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    position: number;
    isDownloadable?: boolean;
    isActive?: boolean;
  },
  context: TenantContext,
) => {
  // Récupération du tenant de l'utilisateur connecté.
  const tenantId = ensureTenantContext(context);

  // Vérification de l'appartenance de la leçon au tenant.
  await ensureLessonBelongsToTenant(
    data.lessonId,
    tenantId,
  );

  // Vérification de l'unicité de la position.
  await ensurePositionIsAvailable(
    tenantId,
    data.lessonId,
    data.position,
  );

  // Création de la ressource avec le tenant courant.
  return prisma.resource.create({
    data: {
      tenantId,
      lessonId: data.lessonId,
      title: data.title,
      description: data.description,
      type: data.type,
      url: data.url,
      fileName: data.fileName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      position: data.position,
      isDownloadable: data.isDownloadable,
      isActive: data.isActive,
    },

    // Retourne également les informations de la leçon.
    include: {
      lesson: true,
    },
  });
};

/**
 * Liste toutes les ressources d'une leçon.
 */
export const listResourcesByLesson = async (
  lessonId: string,
  context: TenantContext,
) => {
  // Récupération du tenant courant.
  const tenantId = ensureTenantContext(context);

  // Vérification de la leçon.
  await ensureLessonBelongsToTenant(
    lessonId,
    tenantId,
  );

  // Recherche uniquement dans le tenant courant.
  return prisma.resource.findMany({
    where: {
      tenantId,
      lessonId,
    },

    // Les ressources sont retournées dans leur ordre.
    orderBy: {
      position: "asc",
    },

    include: {
      lesson: true,
    },
  });
};

/**
 * Récupère une ressource précise.
 */
export const getResourceById = async (
  id: string,
  context: TenantContext,
) => {
  // Récupération du tenant courant.
  const tenantId = ensureTenantContext(context);

  // Recherche avec l'identifiant ET le tenant.
  const resource = await prisma.resource.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      lesson: true,
    },
  });

  if (!resource) {
    throw new AppError(
      404,
      "Resource not found",
    );
  }

  return resource;
};

/**
 * Modifie une ressource existante.
 */
export const updateResource = async (
  id: string,
  data: {
    title?: string;
    description?: string | null;
    type?:
      | "PDF"
      | "DOCUMENT"
      | "IMAGE"
      | "VIDEO"
      | "LINK"
      | "OTHER";
    url?: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
    position?: number;
    isDownloadable?: boolean;
    isActive?: boolean;
  },
  context: TenantContext,
) => {
  // Récupération du tenant courant.
  const tenantId = ensureTenantContext(context);

  // Vérification de l'existence de la ressource
  // dans le tenant courant.
  const existingResource =
    await prisma.resource.findFirst({
      where: {
        id,
        tenantId,
      },
    });

  if (!existingResource) {
    throw new AppError(
      404,
      "Resource not found",
    );
  }

  // Si la position est modifiée,
  // vérifier qu'elle reste disponible.
  if (
    data.position !== undefined &&
    data.position !== existingResource.position
  ) {
    await ensurePositionIsAvailable(
      tenantId,
      existingResource.lessonId,
      data.position,
      id,
    );
  }

  // Mise à jour de la ressource.
  return prisma.resource.update({
    where: {
      id,
    },

    data,

    include: {
      lesson: true,
    },
  });
};

/**
 * Supprime une ressource.
 */
export const deleteResource = async (
  id: string,
  context: TenantContext,
) => {
  // Récupération du tenant courant.
  const tenantId = ensureTenantContext(context);

  // Vérification de l'existence de la ressource
  // dans le tenant courant.
  const existingResource =
    await prisma.resource.findFirst({
      where: {
        id,
        tenantId,
      },
    });

  if (!existingResource) {
    throw new AppError(
      404,
      "Resource not found",
    );
  }

  // Suppression définitive de la ressource.
  await prisma.resource.delete({
    where: {
      id,
    },
  });

  return {
    message: "Resource deleted successfully",
  };
};