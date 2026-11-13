
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma, type Prisma as PrismaTypes } from "../../generated/prisma/client.js";import type {
  LearningPathEventType,
} from "../../generated/prisma/enums.js";

export type LearningPathContext = {
  userId: string;
  tenantId: string | null;
  roleId: string | null;
  systemRole: "SUPER_ADMIN" | null;
};

type LearningPathEvent = {
  tenantId: string;
  eventId: string;
  eventType: LearningPathEventType;
  aggregateId: string;
  payload: Prisma.JsonValue;
};

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

function ensureTenantContext(context: LearningPathContext): string {
  if (!context.userId) {
    throw new AppError(401, "Authentication is required");
  }

  if (!context.tenantId) {
    throw new AppError(403, "Tenant context is required");
  }

  if (!context.roleId || context.systemRole === "SUPER_ADMIN") {
    throw new AppError(
      403,
      "Learning paths are not available for this role",
    );
  }

  return context.tenantId;
}

async function ensureLearner(
  context: LearningPathContext,
  tenantId: string,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      id: context.userId,
      tenantId,
      roleId: context.roleId,
      isActive: true,
    },
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user || user.role?.name !== "APPRENANT") {
    throw new AppError(
      403,
      "Only active learners can access learning paths",
    );
  }
}

/**
 * Génère un parcours initial à partir des leçons actives
 * d'une formation publiée.
 *
 * Les leçons sont ordonnées par module puis par position.
 * Les leçons déjà terminées sont conservées comme étapes terminées.
 */
export async function generateLearningPath(
  context: LearningPathContext,
  formationId: string,
) {
  const tenantId = ensureTenantContext(context);
  await ensureLearner(context, tenantId);

  if (!formationId) {
    throw new AppError(400, "Formation ID is required");
  }

  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findFirst({
      where: {
        tenantId,
        userId: context.userId,
        formationId,
        status: "ACTIVE",
        formation: {
          status: "PUBLISHED",
        },
        user: {
          isActive: true,
          role: {
            name: "APPRENANT",
          },
        },
      },
      select: {
        formation: {
          select: {
            id: true,
            title: true,
            modules: {
              where: {
                tenantId,
                isActive: true,
              },
              orderBy: {
                position: "asc",
              },
              select: {
                id: true,
                title: true,
                position: true,
                lessons: {
                  where: {
                    tenantId,
                    isActive: true,
                  },
                  orderBy: {
                    position: "asc",
                  },
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    position: true,
                    progress: {
                      where: {
                        tenantId,
                        userId: context.userId,
                      },
                      select: {
                        isCompleted: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new AppError(
        404,
        "Active enrollment in a published formation not found",
      );
    }

    
const existingPath = await tx.learningPath.findFirst({
  where: {
    tenantId,
    userId: context.userId,
    formationId,
    status: {
      in: ["ACTIVE", "ARCHIVED"],
    },
  },
  include: {
    steps: {
      orderBy: {
        position: "asc",
      },
    },
  },
});

if (existingPath) {
  if (existingPath.status === "ARCHIVED") {
    return tx.learningPath.update({
      where: {
        id: existingPath.id,
      },
      data: {
        status: "ACTIVE",
        completedAt: null,
      },
      include: {
        steps: {
          orderBy: {
            position: "asc",
          },
        },
        formation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  return existingPath;
}


    const lessons = enrollment.formation.modules.flatMap((module) =>
      module.lessons.map((lesson) => ({
        ...lesson,
        isCompleted: lesson.progress.some(
          (progress) => progress.isCompleted,
        ),
      })),
    );

    if (lessons.length === 0) {
      throw new AppError(
        422,
        "This formation does not contain any active lesson",
      );
    }

    const allCompleted = lessons.every((lesson) => lesson.isCompleted);

    
const path = await tx.learningPath.create({
  data: {
    tenantId,
    userId: context.userId,
    formationId,
    status: allCompleted ? "COMPLETED" : "ACTIVE",
    generationVersion: 1,
    completedAt: allCompleted ? new Date() : null,
  },
});

await tx.learningPathStep.createMany({
  data: lessons.map((lesson, index) => ({
    tenantId,
    learningPathId: path.id,
    lessonId: lesson.id,
    position: index + 1,
    titleSnapshot: lesson.title,
    objective:
      lesson.description?.trim() ||
      `Étudier et comprendre la leçon : ${lesson.title}`,
    stepType: "LESSON",
    recommendationReason:
      "Étape générée à partir de l'ordre pédagogique de la formation.",
    status: lesson.isCompleted ? "COMPLETED" : "PENDING",
  })),
});

const createdPath = await tx.learningPath.findFirstOrThrow({
  where: {
    id: path.id,
    tenantId,
  },
  include: {
    steps: {
      orderBy: {
        position: "asc",
      },
    },
    formation: {
      select: {
        id: true,
        title: true,
      },
    },
  },
});

return createdPath;

  });
}


/**
 * Adapte un parcours existant à la progression réelle de l'apprenant.
 * Les étapes terminées ne sont jamais réinitialisées.
 */
export async function adaptLearningPath(
  context: LearningPathContext,
  formationId: string,
  options: {
    allowCompletedEnrollment?: boolean;
  } = {},
) {
  const tenantId = ensureTenantContext(context);
  await ensureLearner(context, tenantId);

  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findFirst({
      where: {
        tenantId,
        userId: context.userId,
        formationId,
        status: options.allowCompletedEnrollment
          ? { in: ["ACTIVE", "COMPLETED"] }
          : "ACTIVE",
        formation: {
          status: "PUBLISHED",
        },
      },
      select: {
        formation: {
          select: {
            modules: {
              where: { tenantId, isActive: true },
              orderBy: { position: "asc" },
              select: {
                lessons: {
                  where: { tenantId, isActive: true },
                  orderBy: { position: "asc" },
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    progress: {
                      where: {
                        tenantId,
                        userId: context.userId,
                      },
                      select: { isCompleted: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new AppError(404, "Active enrollment not found");
    }

    const path = await tx.learningPath.findFirst({
      where: {
        tenantId,
        userId: context.userId,
        formationId,
        status: "ACTIVE",
      },
      include: {
        steps: {
          orderBy: [
            { position: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });

    if (!path) {
      throw new AppError(404, "Active learning path not found");
    }

    const lessons = enrollment.formation.modules.flatMap(
      (module) => module.lessons,
    );

    const existingStepsByLesson = new Map(
      path.steps
        .filter((step) => step.stepType === "LESSON")
        .map((step) => [step.lessonId, step]),
    );

    const orderedSteps = lessons.map((lesson) => {
      const existing = existingStepsByLesson.get(lesson.id);

      const progressCompleted = lesson.progress.some(
        (item) => item.isCompleted,
      );

      return {
        lesson,
        existing,
        completed:
          existing?.status === "COMPLETED" || progressCompleted,
      };
    });

    
const completedLessonIds = new Set(
  orderedSteps.map((item) => item.lesson.id),
);

// Identifier les anciennes leçons terminées à conserver.
const obsoleteCompletedSteps = path.steps.filter(
  (step) =>
    step.stepType === "LESSON" &&
    !completedLessonIds.has(step.lessonId) &&
    step.status === "COMPLETED",
);

// Supprimer uniquement les anciennes leçons non terminées.
const obsoleteSteps = path.steps.filter(
  (step) =>
    step.stepType === "LESSON" &&
    !completedLessonIds.has(step.lessonId) &&
    step.status !== "COMPLETED",
);

if (obsoleteSteps.length > 0) {
  await tx.learningPathStep.deleteMany({
    where: {
      tenantId,
      learningPathId: path.id,
      id: { in: obsoleteSteps.map((step) => step.id) },
      status: { not: "COMPLETED" },
    },
  });
}

// Conserver les révisions dans leur ordre actuel.
const revisionSteps = path.steps.filter(
  (step) => step.stepType === "REVISION",
);

// Toutes les étapes conservées sont temporairement déplacées
// vers des positions inférieures à toutes les positions existantes.
const remainingSteps = path.steps.filter(
  (step) =>
    !obsoleteSteps.some((obsolete) => obsolete.id === step.id),
);

const minimumPosition = Math.min(
  0,
  ...remainingSteps.map((step) => step.position),
);

for (const [index, step] of remainingSteps.entries()) {
  await tx.learningPathStep.update({
    where: {
      tenantId_id: {
        tenantId,
        id: step.id,
      },
    },
    data: {
      position: minimumPosition - index - 1,
    },
  });
}

const now = new Date();

// Réattribuer les positions des leçons actives.
for (const [index, item] of orderedSteps.entries()) {
  if (!item.existing) {
    await tx.learningPathStep.create({
      data: {
        tenantId,
        learningPathId: path.id,
        lessonId: item.lesson.id,
        position: index + 1,
        titleSnapshot: item.lesson.title,
        objective:
          item.lesson.description?.trim() ||
          `Étudier et comprendre la leçon : ${item.lesson.title}`,
        stepType: "LESSON",
        recommendationReason:
          "Étape ajoutée lors de l'adaptation du parcours.",
        status: item.completed ? "COMPLETED" : "PENDING",
      },
    });

    continue;
  }

  await tx.learningPathStep.update({
    where: {
      tenantId_id: {
        tenantId,
        id: item.existing.id,
      },
    },
    data: {
      position: index + 1,
      status: item.completed
        ? "COMPLETED"
        : item.existing.status,
    },
  });
}

// Placer les révisions après les leçons actives.
for (const [index, revision] of revisionSteps.entries()) {
  await tx.learningPathStep.update({
    where: {
      tenantId_id: {
        tenantId,
        id: revision.id,
      },
    },
    data: {
      position: orderedSteps.length + index + 1,
    },
  });
}

// Conserver les anciennes leçons terminées à la fin du parcours.
const historicalStepsStart =
  orderedSteps.length + revisionSteps.length;

for (const [index, historicalStep] of obsoleteCompletedSteps.entries()) {
  await tx.learningPathStep.update({
    where: {
      tenantId_id: {
        tenantId,
        id: historicalStep.id,
      },
    },
    data: {
      position: historicalStepsStart + index + 1,
    },
  });
}


    const allStepsCompleted =
      orderedSteps.length > 0 &&
      orderedSteps.every((item) => item.completed) &&
      revisionSteps.every(
        (step) => step.status === "COMPLETED",
      );

    await tx.learningPath.update({
      where: {
        tenantId_id: {
          tenantId,
          id: path.id,
        },
      },
      data: {
        status: allStepsCompleted ? "COMPLETED" : "ACTIVE",
        completedAt: allStepsCompleted ? now : null,
        lastAdaptedAt: now,
      },
    });

    return tx.learningPath.findFirstOrThrow({
      where: {
        tenantId,
        id: path.id,
      },
      include: {
        steps: {
          orderBy: { position: "asc" },
        },
        formation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  });
}


/**
 * Archive le parcours actif d'un apprenant pour une formation.
 * Utilisé notamment après l'annulation ou la suppression d'une inscription.
 */
export async function archiveLearningPath(
  tenantId: string,
  userId: string,
  formationId: string,
): Promise<void> {
  if (!tenantId || !userId || !formationId) {
    throw new AppError(400, "Tenant, user and formation IDs are required");
  }

  await prisma.learningPath.updateMany({
    where: {
      tenantId,
      userId,
      formationId,
      status: "ACTIVE",
    },
    data: {
      status: "ARCHIVED",
      completedAt: null,
    },
  });
}


/**
 * Ajoute une étape de révision après une tentative de quiz échouée.
 *
 * Une tentative terminée et échouée ne génère qu'une seule révision
 * par parcours. Les étapes déjà terminées restent inchangées.
 */
export async function addQuizRevision(
  tenantId: string,
  userId: string,
  attemptId: string,
): Promise<void> {
  if (!tenantId || !userId || !attemptId) {
    throw new AppError(400, "Tenant, user and attempt IDs are required");
  }
  let targetLearningPathId: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      // Récupération d'une tentative terminée et échouée.
      const attempt = await tx.quizAttempt.findFirst({
        where: {
          id: attemptId,
          tenantId,
          userId,
          completedAt: { not: null },
          passed: false,
        },
        select: {
          id: true,
          percentage: true,
          quiz: {
            select: {
              lesson: {
                select: {
                  id: true,
                  title: true,
                  module: {
                    select: {
                      formationId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        return;
      }

      const formationId = attempt.quiz.lesson.module.formationId;
      const lesson = attempt.quiz.lesson;

      // Recherche du parcours actif de l'apprenant.
      const path = await tx.learningPath.findFirst({
        where: {
          tenantId,
          userId,
          formationId,
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      });

      if (!path) {
        return;
      }
      targetLearningPathId = path.id;
      // Vérification de l'existence d'une révision.
      const existingRevision = await tx.learningPathStep.findFirst({
        where: {
          tenantId,
          learningPathId: path.id,
          sourceAttemptId: attempt.id,
        },
        select: {
          id: true,
        },
      });

      if (existingRevision) {
        return;
      }

      // Récupération de la dernière position du parcours.
      const lastStep = await tx.learningPathStep.findFirst({
        where: {
          tenantId,
          learningPathId: path.id,
        },
        orderBy: {
          position: "desc",
        },
        select: {
          position: true,
        },
      });

      // Création de l'étape de révision.
      await tx.learningPathStep.create({
        data: {
          tenantId,
          learningPathId: path.id,
          lessonId: lesson.id,
          sourceAttemptId: attempt.id,
          position: (lastStep?.position ?? 0) + 1,
          titleSnapshot: `Révision : ${lesson.title}`,
          objective: `Revoir les notions de cette leçon après un résultat de ${attempt.percentage} %.`,
          stepType: "REVISION",
          recommendationReason:
            "Une tentative de quiz terminée n'a pas atteint le seuil de réussite.",
          priority: 2,
          status: "PENDING",
        },
      });

      // Mise à jour de la date d'adaptation.
      await tx.learningPath.update({
        where: {
          tenantId_id: {
            tenantId,
            id: path.id,
          },
        },
        data: {
          lastAdaptedAt: new Date(),
        },
      });
    });
  } catch (error) {
    // La transaction est maintenant terminée et annulée en cas d'erreur.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Vérification du doublon en dehors de la transaction.
      const duplicateRevision = targetLearningPathId
  ? await prisma.learningPathStep.findFirst({
      where: {
        tenantId,
        learningPathId: targetLearningPathId,
        sourceAttemptId: attemptId,
        stepType: "REVISION",
      },
      select: {
        id: true,
      },
    })
  : null;

      if (duplicateRevision) {
        return;
      }
    }

    // Toute autre erreur doit être propagée.
    throw error;
  }
}

