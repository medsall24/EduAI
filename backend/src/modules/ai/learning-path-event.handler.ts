
import { z } from "zod";
import type { LearningPathEventType } from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import {
  adaptLearningPath,
  addQuizRevision,
  archiveLearningPath,
  generateLearningPath,
} from "./learning-path.service.js";

/**
 * Récupère le rôle réel d'un apprenant actif dans son tenant.
 */
async function getLearnerRoleId(
  tenantId: string,
  userId: string,
): Promise<string> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      tenantId,
      isActive: true,
      role: {
        name: "APPRENANT",
      },
    },
    select: {
      roleId: true,
      systemRole: true,
    },
  });

  if (!user || !user.roleId || user.systemRole === "SUPER_ADMIN") {
    throw new AppError(403, "Active learner not found in this tenant");
  }

  return user.roleId;
}

async function hasActiveEnrollment(
  tenantId: string,
  userId: string,
  formationId: string,
): Promise<boolean> {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      tenantId,
      userId,
      formationId,
      status: "ACTIVE",
      user: {
        isActive: true,
        role: {
          name: "APPRENANT",
        },
      },
    },
    select: {
      id: true,
    },
  });

  return enrollment !== null;
}

/**
 * Génère les parcours des apprenants ayant une inscription active
 * dans une formation publiée.
 */
async function generatePathsForPublishedFormation(
  tenantId: string,
  formationId: string,
): Promise<void> {
  const formation = await prisma.formation.findFirst({
    where: {
      id: formationId,
      tenantId,
      status: "PUBLISHED",
    },
    select: {
      enrollments: {
        where: {
          tenantId,
          status: "ACTIVE",
          user: {
            isActive: true,
            role: {
              name: "APPRENANT",
            },
          },
        },
        select: {
          userId: true,
          user: {
            select: {
              roleId: true,
              systemRole: true,
            },
          },
        },
      },
    },
  });

  if (!formation) {
    return;
  }

  for (const enrollment of formation.enrollments) {
    if (
      !enrollment.user.roleId ||
      enrollment.user.systemRole === "SUPER_ADMIN"
    ) {
      continue;
    }

    await generateLearningPath(
      {
        userId: enrollment.userId,
        tenantId,
        roleId: enrollment.user.roleId,
        systemRole: enrollment.user.systemRole,
      },
      formationId,
    );
  }
}


const eventPayloadSchema = z.object({
  userId: z.string().uuid().optional(),
  formationId: z.string().uuid().optional(),
  attemptId: z.string().uuid().optional(),
});

type LearningPathEvent = {
  tenantId: string;
  eventId: string;
  eventType: LearningPathEventType;
  aggregateId: string;
  payload: unknown;
};

/**
 * Traite les événements Outbox liés aux parcours personnalisés.
 * Les identifiants métier proviennent exclusivement du payload validé.
 */
export async function handleLearningPathEvent(
  event: LearningPathEvent,
): Promise<void> {
  const parsed = eventPayloadSchema.safeParse(event.payload);

  if (!parsed.success) {
    throw new Error(
      `Invalid payload for learning path event ${event.eventId}`,
    );
  }

  const { userId, formationId, attemptId } = parsed.data;

  switch (event.eventType) {
    case "ENROLLMENT_ACTIVATED": {
      if (!userId || !formationId) {
        throw new Error("Missing userId or formationId");
      }

      if (
  !(await hasActiveEnrollment(
    event.tenantId,
    userId,
    formationId,
  ))
) {
  return;
}

      await generateLearningPath(
        {
          userId,
          tenantId: event.tenantId,
          roleId: await getLearnerRoleId(event.tenantId, userId),
          systemRole: null,
        },
        formationId,
      );
      return;
    }

    case "PROGRESS_UPDATED": {
      if (!userId || !formationId) {
        throw new Error("Missing userId or formationId");
      }

      await adaptLearningPath(
        {
          userId,
          tenantId: event.tenantId,
          roleId: await getLearnerRoleId(event.tenantId, userId),
          systemRole: null,
        },
        formationId,
      );
      return;
    }

    case "QUIZ_SUBMITTED": {
      if (!userId || !attemptId) {
        throw new Error("Missing userId or attemptId");
      }

      await addQuizRevision(event.tenantId, userId, attemptId);
      return;
    }

    case "ENROLLMENT_CANCELLED":
case "ENROLLMENT_DELETED": {
  if (!userId || !formationId) {
    throw new Error("Missing userId or formationId");
  }

  if (
    await hasActiveEnrollment(
      event.tenantId,
      userId,
      formationId,
    )
  ) {
    return;
  }

  await archiveLearningPath(event.tenantId, userId, formationId);
  return;
}

    case "ENROLLMENT_COMPLETED": {
      if (!userId || !formationId) {
        throw new Error("Missing userId or formationId");
      }

      await adaptLearningPath(
  {
    userId,
    tenantId: event.tenantId,
    roleId: await getLearnerRoleId(event.tenantId, userId),
    systemRole: null,
  },
  formationId,
  {
    allowCompletedEnrollment: true,
  },
);
      return;
    }

    case "FORMATION_PUBLISHED": {
      await generatePathsForPublishedFormation(
        event.tenantId,
        event.aggregateId,
      );
      return;
    }

    default: {
      const unsupported: never = event.eventType;
      throw new Error(`Unsupported event: ${unsupported}`);
    }
  }
}
