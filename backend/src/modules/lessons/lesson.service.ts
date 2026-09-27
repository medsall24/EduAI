import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";

/**
 * Contexte de s�curit� transmis au service.
 * Le tenantId provient de l'utilisateur authentifi�.
 */
type TenantContext = {
  tenantId: string | null;
};

/**
 * Donn�es n�cessaires � la cr�ation d'une le�on.
 */
type CreateLessonInput = {
  moduleId: string;
  title: string;
  description?: string;
  type: "TEXT" | "VIDEO" | "DOCUMENT" | "MIXED";
  content?: string;
  videoUrl?: string;
  duration?: number;
  position: number;
  isPreview?: boolean;
  isActive?: boolean;
};

/**
 * Donn�es pouvant �tre modifi�es lors de la mise � jour d'une le�on.
 */
type UpdateLessonInput = {
  title?: string;
  description?: string | null;
  type?: "TEXT" | "VIDEO" | "DOCUMENT" | "MIXED";
  content?: string | null;
  videoUrl?: string | null;
  duration?: number | null;
  position?: number;
  isPreview?: boolean;
  isActive?: boolean;
};

/**
 * V�rifie que la requ�te poss�de un contexte tenant valide.
 * Un utilisateur normal doit obligatoirement �tre rattach� � un tenant.
 */
function ensureTenantContext(context: TenantContext): string {
  if (!context.tenantId) {
    throw new AppError(403, "Tenant context is required");
  }

  return context.tenantId;
}

/**
 * V�rifie que le module demand� appartient au tenant courant.
 * Cette v�rification emp�che l'acc�s � un module d'un autre tenant.
 */
async function ensureModuleBelongsToTenant(
  moduleId: string,
  tenantId: string,
) {
  const module = await prisma.module.findFirst({
    where: {
      id: moduleId,
      tenantId,
    },
  });

  if (!module) {
    throw new AppError(400, "Module not found in this tenant");
  }

  return module;
}

/**
 * V�rifie qu'aucune autre le�on du m�me module
 * n'utilise d�j� la position demand�e.
 *
 * excludedLessonId est utilis� lors d'une modification
 * afin que la le�on puisse conserver sa propre position.
 */
async function ensurePositionIsAvailable(
  moduleId: string,
  tenantId: string,
  position: number,
  excludedLessonId?: string,
) {
  const existingLesson = await prisma.lesson.findFirst({
    where: {
      tenantId,
      moduleId,
      position,
      ...(excludedLessonId ? { id: { not: excludedLessonId } } : {}),
    },
  });

  if (existingLesson) {
    throw new AppError(
  409,
  "A lesson with this position already exists in this module",
);
  }
}

/**
 * Cr�e une nouvelle le�on.
 *
 * La le�on est toujours enregistr�e avec le tenantId
 * provenant du contexte authentifi�.
 */
export async function createLesson(
  context: TenantContext,
  input: CreateLessonInput,
) {
  const tenantId = ensureTenantContext(context);

  // V�rifie que le module appartient au tenant courant.
  await ensureModuleBelongsToTenant(input.moduleId, tenantId);

  // Emp�che les positions dupliqu�es dans le m�me module.
  await ensurePositionIsAvailable(
    input.moduleId,
    tenantId,
    input.position,
  );

  return prisma.lesson.create({
    data: {
      tenantId,
      moduleId: input.moduleId,
      title: input.title,
      description: input.description,
      type: input.type,
      content: input.content,
      videoUrl: input.videoUrl,
      duration: input.duration,
      position: input.position,
      isPreview: input.isPreview ?? false,
      isActive: input.isActive ?? true,
    },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          formationId: true,
        },
      },
    },
  });
}

/**
 * Retourne toutes les le�ons d'un module
 * appartenant au tenant courant.
 */
export async function listLessons(
  context: TenantContext,
  moduleId: string,
) {
  const tenantId = ensureTenantContext(context);

  // V�rifie l'appartenance du module au tenant.
  await ensureModuleBelongsToTenant(moduleId, tenantId);

  return prisma.lesson.findMany({
    where: {
      tenantId,
      moduleId,
    },
    // Les le�ons sont retourn�es dans l'ordre p�dagogique.
    orderBy: {
      position: "asc",
    },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          formationId: true,
        },
      },
    },
  });
}

/**
 * R�cup�re une le�on appartenant au tenant courant.
 *
 * Les ressources associ�es sont �galement retourn�es.
 */
export async function getLesson(
  context: TenantContext,
  id: string,
) {
  const tenantId = ensureTenantContext(context);

  const lesson = await prisma.lesson.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          formationId: true,
        },
      },
      resources: true,
    },
  });

  if (!lesson) {
  throw new AppError(404, "Lesson not found");
}

  return lesson;
}

/**
 * Met � jour une le�on appartenant au tenant courant.
 */
export async function updateLesson(
  context: TenantContext,
  id: string,
  input: UpdateLessonInput,
) {
  const tenantId = ensureTenantContext(context);

  // Recherche uniquement dans le tenant courant.
  const existingLesson = await prisma.lesson.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!existingLesson) {
    throw new AppError(404, "Lesson not found");
  }

  // Si la position change, v�rifie qu'elle reste disponible.
  if (
    input.position !== undefined &&
    input.position !== existingLesson.position
  ) {
    await ensurePositionIsAvailable(
      existingLesson.moduleId,
      tenantId,
      input.position,
      id,
    );
  }

  return prisma.lesson.update({
    where: {
      id,
      tenantId,
    },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.videoUrl !== undefined
        ? { videoUrl: input.videoUrl }
        : {}),
      ...(input.duration !== undefined
        ? { duration: input.duration }
        : {}),
      ...(input.position !== undefined
        ? { position: input.position }
        : {}),
      ...(input.isPreview !== undefined
        ? { isPreview: input.isPreview }
        : {}),
      ...(input.isActive !== undefined
        ? { isActive: input.isActive }
        : {}),
    },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          formationId: true,
        },
      },
    },
  });
}

/**
 * Supprime une le�on appartenant au tenant courant.
 */
export async function deleteLesson(
  context: TenantContext,
  id: string,
) {
  const tenantId = ensureTenantContext(context);

  // V�rifie que la le�on appartient bien au tenant.
  const existingLesson = await prisma.lesson.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!existingLesson) {
    throw new AppError(404, "Lesson not found");
  }

  return prisma.lesson.delete({
    where: {
      id,
      tenantId,
    },
  });
}
