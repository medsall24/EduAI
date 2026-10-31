import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";

/**
 * Contexte minimal nécessaire pour personnaliser les recommandations.
 * Ces valeurs doivent provenir de l'utilisateur authentifié.
 */
export type AIRecommendationContext = {
  userId: string;
  tenantId: string | null;
  roleId: string | null;
  systemRole: "SUPER_ADMIN" | null;
};

/**
 * Vérifie que l'utilisateur possède un contexte tenant valide.
 * Les recommandations pédagogiques personnalisées sont réservées
 * aux utilisateurs rattachés à un tenant.
 */
function ensureTenantContext(
  context: AIRecommendationContext,
): string {
  if (!context.userId) {
    throw new AppError(401, "Authentication is required");
  }

  if (!context.tenantId) {
    throw new AppError(403, "Tenant context is required");
  }

  if (!context.roleId || context.systemRole === "SUPER_ADMIN") {
    throw new AppError(
      403,
      "Personalized recommendations are not available for this role",
    );
  }

  return context.tenantId;
}

/**
 * Vérifie le rôle métier réel de l'utilisateur dans son tenant.
 * Le nom du rôle n'est pas supposé provenir du JWT.
 */
async function ensureLearner(
  context: AIRecommendationContext,
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
      "Only learners can access personalized recommendations",
    );
  }
}

/**
 * Retourne des recommandations pédagogiques à partir des données réelles.
 *
 * Priorités :
 * 1. Proposer les premières leçons actives non terminées des formations
 *    auxquelles l'apprenant est activement inscrit.
 * 2. Proposer des formations publiées et pertinentes auxquelles il
 *    n'est pas déjà inscrit.
 *
 * Aucune génération IA n'est exécutée dans cette première version.
 */
export async function getPedagogicalRecommendations(
  context: AIRecommendationContext,
) {
  const tenantId = ensureTenantContext(context);

  // Vérifie le rôle métier avant toute lecture des données pédagogiques.
  await ensureLearner(context, tenantId);

  // Charge uniquement les inscriptions actives de l'apprenant.
  const enrollments = await prisma.enrollment.findMany({
    where: {
      tenantId,
      userId: context.userId,
      status: "ACTIVE",
      formation: {
        status: "PUBLISHED",
        category: {
          isActive: true,
        },
      },
    },
    select: {
      formationId: true,
      formation: {
        select: {
          id: true,
          title: true,
          description: true,
          categoryId: true,
          category: {
            select: {
              name: true,
            },
          },
          modules: {
            where: {
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
                  type: true,
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

  // Prépare les recommandations de leçons non terminées.
  const lessonRecommendations: Array<{
    type: "LESSON";
    formationId: string;
    formationTitle: string;
    category: string;
    moduleId: string;
    moduleTitle: string;
    lessonId: string;
    lessonTitle: string;
    lessonType: string;
    reason: string;
  }> = [];

  // Conserve les identifiants des formations déjà suivies.
  const enrolledFormationIds = enrollments.map(
    (enrollment) => enrollment.formationId,
  );

  for (const enrollment of enrollments) {
    const formation = enrollment.formation;

    // Cherche la première leçon active non terminée dans l'ordre du cours.
    let nextLesson:
      | (typeof formation.modules)[number]["lessons"][number]
      | undefined;
    let nextModule:
      | (typeof formation.modules)[number]
      | undefined;

    for (const module of formation.modules) {
      const lesson = module.lessons.find(
        (item) => !item.progress.some((progress) => progress.isCompleted),
      );

      if (lesson) {
        nextLesson = lesson;
        nextModule = module;
        break;
      }
    }

    // Ignore une formation si toutes ses leçons actives sont terminées.
    if (!nextLesson || !nextModule) {
      continue;
    }

    lessonRecommendations.push({
      type: "LESSON",
      formationId: formation.id,
      formationTitle: formation.title,
      category: formation.category.name,
      moduleId: nextModule.id,
      moduleTitle: nextModule.title,
      lessonId: nextLesson.id,
      lessonTitle: nextLesson.title,
      lessonType: nextLesson.type,
      reason: "Continuer votre progression dans une formation en cours.",
    });
  }

  // Détermine les catégories des formations actuellement suivies.
  const enrolledCategoryIds = [
    ...new Set(
      enrollments.map(
        (enrollment) => enrollment.formation.categoryId,
      ),
    ),
  ];

  
  // Recherche des formations publiées que l'apprenant ne suit pas déjà.
  const availableFormations = await prisma.formation.findMany({
    where: {
      tenantId,
      status: "PUBLISHED",
      category: {
        isActive: true,
      },

      // Exclut toutes les formations déjà inscrites pour cet apprenant,
      // quel que soit le statut de son inscription.
      enrollments: {
        none: {
          tenantId,
          userId: context.userId,
        },
      },

      // Conserve une protection supplémentaire pour les formations actives.
      id: {
        notIn: enrolledFormationIds,
      },

      // Ne propose que les formations qui possèdent du contenu actif.
      modules: {
        some: {
          isActive: true,
          lessons: {
            some: {
              tenantId,
              isActive: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
    select: {
      id: true,
      title: true,
      description: true,
      categoryId: true,
      category: {
        select: {
          name: true,
        },
      },
      modules: {
        where: {
          isActive: true,
        },
        select: {
          lessons: {
            where: {
              tenantId,
              isActive: true,
            },
            select: {
              id: true,
            },
          },
        },
      },
    },
  });


  // Favorise les catégories déjà suivies, puis les autres formations publiées.
const formationRecommendations = availableFormations
  .map((formation) => ({
    type: "FORMATION" as const,
    formationId: formation.id,
    formationTitle: formation.title,
    description: formation.description,
    category: formation.category.name,
    reason: enrolledCategoryIds.includes(formation.categoryId)
      ? "Cette formation appartient à une catégorie que vous étudiez déjà."
      : "Découvrez une nouvelle formation disponible.",
    activeLessonCount: formation.modules.reduce(
      (total, module) => total + module.lessons.length,
      0,
    ),
    categoryMatch: enrolledCategoryIds.includes(formation.categoryId),
  }))
  .sort((first, second) => {
    if (first.categoryMatch !== second.categoryMatch) {
      return first.categoryMatch ? -1 : 1;
    }

    return 0;
  })
  .map(({ categoryMatch: _categoryMatch, ...formation }) => formation)
  .slice(0, 5);

  // Retourne les recommandations sans exposer les données privées de l'apprenant.
  return {
    generatedAt: new Date().toISOString(),
    strategy: "RULE_BASED",
    lessons: lessonRecommendations.slice(0, 5),
    formations: formationRecommendations,
  };
}
