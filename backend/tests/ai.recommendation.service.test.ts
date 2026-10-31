
import { beforeEach, describe, expect, it, vi } from "vitest";

// Simule les méthodes Prisma utilisées par le service de recommandations.
const {
  userFindFirst,
  enrollmentFindMany,
  formationFindMany,
} = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  enrollmentFindMany: vi.fn(),
  formationFindMany: vi.fn(),
}));

// Remplace Prisma par des fonctions simulées pour isoler les tests.
vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: userFindFirst,
    },
    enrollment: {
      findMany: enrollmentFindMany,
    },
    formation: {
      findMany: formationFindMany,
    },
  },
}));

// Importe le service après la déclaration du mock Prisma.
import {
  getPedagogicalRecommendations,
} from "../src/modules/ai/ai.recommendation.service.js";

// Contexte fictif d'un apprenant rattaché à un tenant.
const context = {
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "11111111-1111-4111-8111-111111111111",
  roleId: "22222222-2222-4222-8222-222222222222",
  systemRole: null,
};

describe("AI pedagogical recommendation service", () => {
  beforeEach(() => {
    // Réinitialise les appels simulés avant chaque test.
    vi.clearAllMocks();

    // Simule un utilisateur actif possédant le rôle APPRENANT.
    userFindFirst.mockResolvedValue({
      role: {
        name: "APPRENANT",
      },
    });

    // Simule l'absence de formation déjà suivie.
    enrollmentFindMany.mockResolvedValue([]);

    // Simule l'absence de formation supplémentaire disponible.
    formationFindMany.mockResolvedValue([]);
  });

  it("refuse l'accès lorsque le contexte tenant est absent", async () => {
    // Vérifie qu'un contexte sans tenant est rejeté avant toute requête métier.
    await expect(
      getPedagogicalRecommendations({
        ...context,
        tenantId: null,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Tenant context is required",
    });

    expect(userFindFirst).not.toHaveBeenCalled();
    expect(enrollmentFindMany).not.toHaveBeenCalled();
    expect(formationFindMany).not.toHaveBeenCalled();
  });

  it("refuse l'accès à un utilisateur qui n'est pas apprenant", async () => {
    // Simule un utilisateur possédant le rôle FORMATEUR.
    userFindFirst.mockResolvedValueOnce({
      role: {
        name: "FORMATEUR",
      },
    });

    // Vérifie que le rôle métier est contrôlé avant les lectures pédagogiques.
    await expect(
      getPedagogicalRecommendations(context),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only learners can access personalized recommendations",
    });

    expect(userFindFirst).toHaveBeenCalledOnce();
    expect(enrollmentFindMany).not.toHaveBeenCalled();
    expect(formationFindMany).not.toHaveBeenCalled();
  });

  it("retourne une réponse vide lorsqu'aucune recommandation n'est disponible", async () => {
    // Vérifie le format de réponse lorsque l'apprenant n'a aucun contenu à poursuivre.
    const result = await getPedagogicalRecommendations(context);

    expect(result.strategy).toBe("RULE_BASED");
    expect(result.lessons).toEqual([]);
    expect(result.formations).toEqual([]);
    expect(result.generatedAt).toBeTypeOf("string");

    // Vérifie que les requêtes utilisent le tenant et l'utilisateur authentifiés.
    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        id: context.userId,
        tenantId: context.tenantId,
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

    expect(enrollmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: context.tenantId,
          userId: context.userId,
          status: "ACTIVE",
        }),
      }),
    );

    
    // Vérifie que seules les formations du tenant sont recherchées,
    // et que celles déjà inscrites pour cet apprenant sont exclues.
    expect(formationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: context.tenantId,
          status: "PUBLISHED",
          enrollments: {
            none: {
              tenantId: context.tenantId,
              userId: context.userId,
            },
          },
        }),
      }),
    );

  });

  
  it("recommande la première leçon active non terminée", async () => {
    // Simule une formation publiée avec une première leçon déjà terminée.
    enrollmentFindMany.mockResolvedValueOnce([
      {
        formationId: "formation-1",
        formation: {
          id: "formation-1",
          title: "Introduction à la programmation",
          description: "Les bases de la programmation.",
          categoryId: "category-1",
          category: {
            name: "Informatique",
          },
          modules: [
            {
              id: "module-1",
              title: "Les variables",
              position: 1,
              lessons: [
                {
                  id: "lesson-1",
                  title: "Première leçon",
                  description: null,
                  type: "TEXT",
                  position: 1,
                  progress: [{ isCompleted: true }],
                },
                {
                  id: "lesson-2",
                  title: "Deuxième leçon",
                  description: null,
                  type: "VIDEO",
                  position: 2,
                  progress: [],
                },
              ],
            },
          ],
        },
      },
    ]);

    // Aucune autre formation n'est proposée dans ce scénario.
    formationFindMany.mockResolvedValueOnce([]);

    // Exécute le service avec le contexte fictif de l'apprenant.
    const result = await getPedagogicalRecommendations(context);

    // Vérifie que la leçon terminée est ignorée.
    expect(result.lessons).toHaveLength(1);
    expect(result.lessons[0].lessonId).toBe("lesson-2");
    expect(result.lessons[0].lessonTitle).toBe("Deuxième leçon");
    expect(result.lessons[0].formationId).toBe("formation-1");
  });


  
  it("priorise les formations appartenant aux catégories déjà étudiées", async () => {
    // Simule une inscription active dans la catégorie Informatique.
    enrollmentFindMany.mockResolvedValueOnce([
      {
        formationId: "formation-suivie",
        formation: {
          id: "formation-suivie",
          title: "Programmation en cours",
          description: null,
          categoryId: "category-informatique",
          category: {
            name: "Informatique",
          },
          modules: [],
        },
      },
    ]);

    // Simule deux formations disponibles, dont une de la même catégorie.
    formationFindMany.mockResolvedValueOnce([
      {
        id: "formation-autre",
        title: "Introduction à la gestion",
        description: null,
        categoryId: "category-gestion",
        category: {
          name: "Gestion",
        },
        modules: [
          {
            lessons: [{ id: "lesson-gestion" }],
          },
        ],
      },
      {
        id: "formation-informatique",
        title: "Programmation avancée",
        description: null,
        categoryId: "category-informatique",
        category: {
          name: "Informatique",
        },
        modules: [
          {
            lessons: [{ id: "lesson-programmation" }],
          },
        ],
      },
    ]);

    // Calcule les recommandations pour l'apprenant simulé.
    const result = await getPedagogicalRecommendations(context);

    // Vérifie que la formation de la catégorie déjà étudiée est prioritaire.
    expect(result.formations).toHaveLength(2);
    expect(result.formations[0].formationId).toBe("formation-informatique");
    expect(result.formations[0].reason).toContain(
      "catégorie que vous étudiez déjà",
    );
    expect(result.formations[1].formationId).toBe("formation-autre");
  });

  
  it("refuse les recommandations personnalisées à SUPER_ADMIN", async () => {
    await expect(
      getPedagogicalRecommendations({
        ...context,
        systemRole: "SUPER_ADMIN",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Personalized recommendations are not available for this role",
    });

    expect(userFindFirst).not.toHaveBeenCalled();
    expect(enrollmentFindMany).not.toHaveBeenCalled();
    expect(formationFindMany).not.toHaveBeenCalled();
  });

  it("refuse l'accès si l'utilisateur ne correspond pas au tenant et au rôle attendus", async () => {
    userFindFirst.mockResolvedValueOnce(null);

    await expect(
      getPedagogicalRecommendations(context),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only learners can access personalized recommendations",
    });

    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: context.userId,
          tenantId: context.tenantId,
          roleId: context.roleId,
          isActive: true,
        }),
      }),
    );

    expect(enrollmentFindMany).not.toHaveBeenCalled();
    expect(formationFindMany).not.toHaveBeenCalled();
  });


});
