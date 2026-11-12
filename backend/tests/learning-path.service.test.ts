
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../src/generated/prisma/client.js";
/**
 * ============================================================
 * 1. MOCKS PRISMA
 * ============================================================
 *
 * On simule les méthodes Prisma utilisées par le service
 * des parcours d'apprentissage personnalisés.
 *
 * vi.hoisted() permet de déclarer les mocks avant vi.mock().
 */

const mocks = vi.hoisted(() => {
  // Client transactionnel simulé.
  const transactionClient = {
    enrollment: {
      findFirst: vi.fn(),
    },

    learningPath: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },

    learningPathStep: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },

    quizAttempt: {
      findFirst: vi.fn(),
    },
  };

  return {
    // Recherche et validation de l'utilisateur.
    userFindFirst: vi.fn(),

    rootLearningPathStepFindFirst: vi.fn(),

    // Références aux méthodes du client transactionnel.
    enrollmentFindFirst: transactionClient.enrollment.findFirst,

    learningPathFindFirst: transactionClient.learningPath.findFirst,
    learningPathFindFirstOrThrow:
      transactionClient.learningPath.findFirstOrThrow,
    learningPathCreate: transactionClient.learningPath.create,
    learningPathUpdate: transactionClient.learningPath.update,
    learningPathUpdateMany: transactionClient.learningPath.updateMany,

    learningPathStepCreate:
      transactionClient.learningPathStep.create,
    learningPathStepUpdate:
      transactionClient.learningPathStep.update,
    learningPathStepDeleteMany:
      transactionClient.learningPathStep.deleteMany,
    learningPathStepFindFirst:
      transactionClient.learningPathStep.findFirst,

    quizAttemptFindFirst: transactionClient.quizAttempt.findFirst,

    /**
     * Simulation d'une transaction interactive Prisma.
     *
     * Le callback reçoit le client transactionnel simulé.
     * Les opérations effectuées dans le callback utilisent
     * donc les mêmes mocks.
     */
    transactionMock: vi.fn(
      async (
        callback: (
          transaction: typeof transactionClient,
        ) => Promise<unknown>,
      ) => callback(transactionClient),
    ),
  };
});

/**
 * ============================================================
 * 2. MOCK DU CLIENT PRISMA
 * ============================================================
 *
 * Le service utilise :
 * - prisma.user.findFirst()
 * - prisma.$transaction()
 * - prisma.learningPath.updateMany() pour l'archivage.
 */
vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: mocks.userFindFirst,
    },

    learningPath: {
      updateMany: mocks.learningPathUpdateMany,
    },

    learningPathStep: {
      findFirst: mocks.rootLearningPathStepFindFirst,
    },

    $transaction: mocks.transactionMock,
  },
}));

/**
 * ============================================================
 * 3. IMPORT DU SERVICE À TESTER
 * ============================================================
 */

import {
  generateLearningPath,
  adaptLearningPath,
  archiveLearningPath,
  addQuizRevision,
} from "../src/modules/ai/learning-path.service.js";

/**
 * ============================================================
 * 4. DONNÉES DE TEST
 * ============================================================
 *
 * Contexte fictif d'un apprenant appartenant à un tenant.
 */

const context = {
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "11111111-1111-4111-8111-111111111111",
  roleId: "22222222-2222-4222-8222-222222222222",
  systemRole: null,
};

/**
 * ============================================================
 * 5. SUITE DE TESTS
 * ============================================================
 */

describe("Personalized learning path service", () => {
  /**
   * Réinitialisation des mocks avant chaque test.
   *
   * On simule par défaut un utilisateur actif
   * possédant le rôle APPRENANT.
   */

  beforeEach(() => {
    vi.clearAllMocks();

    // Utilisateur actif avec le rôle APPRENANT.
    mocks.userFindFirst.mockResolvedValue({
      role: {
        name: "APPRENANT",
      },
    });

    // Réinitialisation des réponses Prisma simulées.
    mocks.enrollmentFindFirst.mockResolvedValue(null);

    mocks.learningPathFindFirst.mockResolvedValue(null);
    mocks.learningPathFindFirstOrThrow.mockResolvedValue(null);

    mocks.learningPathCreate.mockResolvedValue(null);
    mocks.learningPathUpdate.mockResolvedValue(null);
    mocks.learningPathUpdateMany.mockResolvedValue({ count: 0 });

    mocks.learningPathStepCreate.mockResolvedValue(null);
    mocks.learningPathStepUpdate.mockResolvedValue(null);
    mocks.learningPathStepDeleteMany.mockResolvedValue({ count: 0 });
    mocks.learningPathStepFindFirst.mockResolvedValue(null);

    mocks.quizAttemptFindFirst.mockResolvedValue(null);
  });

  /**
   * ==========================================================
   * 6. TESTS DE SÉCURITÉ ET DE CONTEXTE
   * ==========================================================
   */

  it("refuse l'accès sans contexte tenant", async () => {
    /**
     * Un utilisateur sans tenant ne doit pas pouvoir
     * accéder aux parcours personnalisés.
     */

    await expect(
      generateLearningPath(
        {
          ...context,
          tenantId: null,
        },
        "formation-1",
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Tenant context is required",
    });

    // Aucune requête métier ne doit être exécutée.
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("refuse l'accès à un utilisateur qui n'est pas apprenant", async () => {
    /**
     * On simule un utilisateur possédant le rôle FORMATEUR.
     */

    mocks.userFindFirst.mockResolvedValueOnce({
      role: {
        name: "FORMATEUR",
      },
    });

    await expect(
      generateLearningPath(context, "formation-1"),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only active learners can access learning paths",
    });

    // La transaction ne doit pas démarrer.
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it("refuse l'accès à SUPER_ADMIN", async () => {
    /**
     * Le SUPER_ADMIN ne peut pas utiliser
     * les parcours pédagogiques d'un apprenant.
     */

    await expect(
      generateLearningPath(
        {
          ...context,
          systemRole: "SUPER_ADMIN",
        },
        "formation-1",
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Learning paths are not available for this role",
    });

    // Aucune requête à la base ne doit être exécutée.
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });


it("refuse de générer un parcours sans inscription active", async () => {
  // Simule l'absence d'inscription active.
  mocks.enrollmentFindFirst.mockResolvedValueOnce(null);

  await expect(
    generateLearningPath(context, "formation-1"),
  ).rejects.toMatchObject({
    statusCode: 404,
    message: "Active enrollment in a published formation not found",
  });

  // Vérifie que la recherche d'inscription a été effectuée.
  expect(mocks.enrollmentFindFirst).toHaveBeenCalledOnce();

  // Aucun parcours ne doit être recherché ou créé.
  expect(mocks.learningPathFindFirst).not.toHaveBeenCalled();
  expect(mocks.learningPathCreate).not.toHaveBeenCalled();
});


it("génère un parcours en conservant la progression réelle de l'apprenant", async () => {
  // Simule une inscription active dans une formation publiée.
  mocks.enrollmentFindFirst.mockResolvedValueOnce({
    formation: {
      id: "formation-1",
      title: "Développement informatique",
      modules: [
        {
          id: "module-1",
          title: "Introduction",
          position: 1,
          lessons: [
            {
              id: "lesson-1",
              title: "Les bases",
              description: "Découvrir les fondamentaux.",
              position: 1,
              progress: [{ isCompleted: true }],
            },
            {
              id: "lesson-2",
              title: "Les variables",
              description: null,
              position: 2,
              progress: [],
            },
          ],
        },
      ],
    },
  });

  // Aucun parcours actif n'existe encore.
  mocks.learningPathFindFirst.mockResolvedValueOnce(null);

  // Résultat simulé de la création du parcours.
  const generatedPath = {
    id: "path-1",
    tenantId: context.tenantId,
    userId: context.userId,
    formationId: "formation-1",
    status: "ACTIVE",
    steps: [
      {
        lessonId: "lesson-1",
        position: 1,
        status: "COMPLETED",
      },
      {
        lessonId: "lesson-2",
        position: 2,
        status: "PENDING",
      },
    ],
  };

  mocks.learningPathCreate.mockResolvedValueOnce(generatedPath);

  // Exécute la génération du parcours.
  const result = await generateLearningPath(context, "formation-1");

  // Vérifie le parcours retourné.
  expect(result).toEqual(generatedPath);

  // Vérifie que le parcours contient deux étapes.
  expect(mocks.learningPathCreate).toHaveBeenCalledOnce();

  const createCall = mocks.learningPathCreate.mock.calls[0][0];

  expect(createCall.data.tenantId).toBe(context.tenantId);
  expect(createCall.data.userId).toBe(context.userId);
  expect(createCall.data.formationId).toBe("formation-1");

  // Vérifie l'ordre et les statuts des étapes créées.
  expect(createCall.data.steps.create).toEqual([
    expect.objectContaining({
      lessonId: "lesson-1",
      position: 1,
      status: "COMPLETED",
    }),
    expect.objectContaining({
      lessonId: "lesson-2",
      position: 2,
      status: "PENDING",
    }),
  ]);
});


it("retourne le parcours actif existant sans en créer un nouveau", async () => {
  // Simule une inscription active.
  mocks.enrollmentFindFirst.mockResolvedValueOnce({
    formation: {
      id: "formation-1",
      title: "Développement informatique",
      modules: [],
    },
  });

  // Simule un parcours déjà généré.
  const existingPath = {
    id: "path-existing",
    tenantId: context.tenantId,
    userId: context.userId,
    formationId: "formation-1",
    status: "ACTIVE",
    steps: [
      {
        id: "step-1",
        lessonId: "lesson-1",
        position: 1,
        status: "PENDING",
      },
    ],
  };

  mocks.learningPathFindFirst.mockResolvedValueOnce(existingPath);

  // Exécute la génération.
  const result = await generateLearningPath(context, "formation-1");

  // Le parcours existant doit être retourné.
  expect(result).toEqual(existingPath);

  // Aucun nouveau parcours ne doit être créé.
  expect(mocks.learningPathCreate).not.toHaveBeenCalled();

  // Vérifie la recherche du parcours avec le bon contexte.
  expect(mocks.learningPathFindFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        tenantId: context.tenantId,
        userId: context.userId,
        formationId: "formation-1",
        status: "ACTIVE",
      },
    }),
  );
});


it("conserve les leçons terminées et respecte leur statut pendant l'adaptation", async () => {
  // Simule une inscription active et une formation publiée.
  mocks.enrollmentFindFirst.mockResolvedValueOnce({
    formation: {
      modules: [
        {
          lessons: [
            {
              id: "lesson-1",
              title: "Introduction",
              description: null,
              progress: [{ isCompleted: true }],
            },
            {
              id: "lesson-2",
              title: "Chapitre 2",
              description: null,
              progress: [],
            },
          ],
        },
      ],
    },
  });

  // Parcours existant avec une première leçon déjà terminée.
  const existingPath = {
    id: "path-1",
    steps: [
      {
        id: "step-1",
        lessonId: "lesson-1",
        stepType: "LESSON",
        position: 1,
        status: "COMPLETED",
        createdAt: new Date("2026-11-01"),
      },
    ],
  };

  mocks.learningPathFindFirst.mockResolvedValueOnce(existingPath);

  // Résultat final simulé après adaptation.
  mocks.learningPathFindFirstOrThrow.mockResolvedValueOnce({
    ...existingPath,
    steps: [
      {
        id: "step-1",
        lessonId: "lesson-1",
        position: 1,
        status: "COMPLETED",
      },
      {
        id: "step-2",
        lessonId: "lesson-2",
        position: 2,
        status: "PENDING",
      },
    ],
  });

  const result = await adaptLearningPath(context, "formation-1");

  // La leçon terminée doit conserver son statut.
  expect(result.steps[0]).toMatchObject({
    lessonId: "lesson-1",
    position: 1,
    status: "COMPLETED",
  });

  // La nouvelle leçon doit être ajoutée.
  expect(mocks.learningPathStepCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        lessonId: "lesson-2",
        position: 2,
        status: "PENDING",
      }),
    }),
  );

  // Le parcours reste actif puisque toutes les leçons ne sont pas terminées.
  expect(mocks.learningPathUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: "ACTIVE",
        completedAt: null,
      }),
    }),
  );
});


it("conserve les anciennes leçons terminées et les révisions, mais supprime les leçons obsolètes non terminées", async () => {
  // Formation : seule la leçon active lesson-2 doit rester dans le parcours courant.
  mocks.enrollmentFindFirst.mockResolvedValueOnce({
    formation: {
      modules: [
        {
          lessons: [
            {
              id: "lesson-2",
              title: "Nouvelle leçon",
              description: null,
              progress: [],
            },
          ],
        },
      ],
    },
  });

  // Parcours existant avec :
  // - une ancienne leçon terminée ;
  // - une ancienne leçon non terminée ;
  // - une étape de révision.
  const existingPath = {
    id: "path-1",
    steps: [
      {
        id: "step-completed",
        lessonId: "lesson-1",
        stepType: "LESSON",
        position: 1,
        status: "COMPLETED",
        createdAt: new Date("2026-11-01"),
      },
      {
        id: "step-obsolete",
        lessonId: "lesson-obsolete",
        stepType: "LESSON",
        position: 2,
        status: "PENDING",
        createdAt: new Date("2026-11-02"),
      },
      {
        id: "step-revision",
        lessonId: null,
        stepType: "REVISION",
        position: 3,
        status: "PENDING",
        createdAt: new Date("2026-11-03"),
      },
    ],
  };

  mocks.learningPathFindFirst.mockResolvedValueOnce(existingPath);

  // Résultat final simulé après adaptation.
  mocks.learningPathFindFirstOrThrow.mockResolvedValueOnce({
    id: "path-1",
    steps: [
      {
        id: "step-new",
        lessonId: "lesson-2",
        stepType: "LESSON",
        position: 1,
        status: "PENDING",
      },
      {
        id: "step-revision",
        lessonId: null,
        stepType: "REVISION",
        position: 2,
        status: "PENDING",
      },
      {
        id: "step-completed",
        lessonId: "lesson-1",
        stepType: "LESSON",
        position: 3,
        status: "COMPLETED",
      },
    ],
  });

  const result = await adaptLearningPath(context, "formation-1");

  // L'ancienne leçon terminée doit être conservée.
  expect(result.steps).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "step-completed",
        lessonId: "lesson-1",
        status: "COMPLETED",
      }),
    ]),
  );

  // L'étape de révision doit être conservée.
  expect(result.steps).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "step-revision",
        stepType: "REVISION",
      }),
    ]),
  );

  // L'ancienne leçon non terminée doit être supprimée.
  expect(mocks.learningPathStepDeleteMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: expect.objectContaining({
          in: expect.arrayContaining(["step-obsolete"]),
        }),
      }),
    }),
  );

  // La nouvelle leçon doit être créée.
  expect(mocks.learningPathStepCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        lessonId: "lesson-2",
        stepType: "LESSON",
        status: "PENDING",
      }),
    }),
  );
});


it("archive le parcours actif de l'apprenant sans modifier les autres parcours", async () => {
  mocks.learningPathUpdateMany.mockResolvedValueOnce({ count: 1 });

await archiveLearningPath(
  context.tenantId!,
  context.userId,
  "formation-1",
);
  expect(mocks.learningPathUpdateMany).toHaveBeenCalledWith({
    where: {
      tenantId: context.tenantId,
      userId: context.userId,
      formationId: "formation-1",
      status: "ACTIVE",
    },
    data: {
      status: "ARCHIVED",
      completedAt: null,
    },
  });
});


it("crée une étape de révision après une tentative de quiz échouée", async () => {
  // Simulation d'une tentative de quiz terminée et échouée.
  mocks.quizAttemptFindFirst.mockResolvedValueOnce({
    id: "attempt-1",
    percentage: 45,
    quiz: {
      lesson: {
        id: "lesson-1",
        title: "Introduction à la programmation",
        module: {
          formationId: "formation-1",
        },
      },
    },
  });

  // Simulation d'un parcours actif.
  mocks.learningPathFindFirst.mockResolvedValueOnce({
    id: "path-1",
  });

  // Aucune révision existante pour cette tentative.
  // La dernière étape du parcours est en position 4.
  mocks.learningPathStepFindFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ position: 4 });

  await addQuizRevision(
    context.tenantId!,
    context.userId,
    "attempt-1",
  );

  // Vérifier la création de l'étape de révision.
  expect(mocks.learningPathStepCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        tenantId: context.tenantId,
        learningPathId: "path-1",
        lessonId: "lesson-1",
        sourceAttemptId: "attempt-1",
        position: 5,
        titleSnapshot: "Révision : Introduction à la programmation",
        stepType: "REVISION",
        status: "PENDING",
        priority: 2,
      }),
    }),
  );

  // Vérifier la mise à jour de la date d'adaptation.
  expect(mocks.learningPathUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        tenantId_id: {
          tenantId: context.tenantId,
          id: "path-1",
        },
      },
      data: {
        lastAdaptedAt: expect.any(Date),
      },
    }),
  );
});


it("ne crée pas une deuxième révision pour une tentative déjà traitée", async () => {
  mocks.quizAttemptFindFirst.mockResolvedValueOnce({
    id: "attempt-1",
    percentage: 45,
    quiz: {
      lesson: {
        id: "lesson-1",
        title: "Introduction à la programmation",
        module: {
          formationId: "formation-1",
        },
      },
    },
  });

  mocks.learningPathFindFirst.mockResolvedValueOnce({
    id: "path-1",
  });

  // Une révision existe déjà pour cette tentative.
  mocks.learningPathStepFindFirst.mockResolvedValueOnce({
    id: "revision-existing",
  });

  await addQuizRevision(
    context.tenantId!,
    context.userId,
    "attempt-1",
  );

  // Aucune nouvelle étape ne doit être créée.
  expect(mocks.learningPathStepCreate).not.toHaveBeenCalled();

  // La date d'adaptation ne doit pas être modifiée.
  expect(mocks.learningPathUpdate).not.toHaveBeenCalled();
});


it("ne crée aucune révision lorsqu'une tentative de quiz n'est pas éligible", async () => {
  // Tentative réussie : elle ne doit pas générer de révision.
  mocks.quizAttemptFindFirst.mockResolvedValueOnce(null);

  await addQuizRevision(
    context.tenantId!,
    context.userId,
    "attempt-passed",
  );

  expect(mocks.quizAttemptFindFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: "attempt-passed",
        tenantId: context.tenantId,
        userId: context.userId,
        completedAt: { not: null },
        passed: false,
      }),
    }),
  );

  expect(mocks.learningPathStepCreate).not.toHaveBeenCalled();
  expect(mocks.learningPathUpdate).not.toHaveBeenCalled();
});


it("ne crée aucune révision lorsqu'aucun parcours actif n'existe", async () => {
  mocks.quizAttemptFindFirst.mockResolvedValueOnce({
    id: "attempt-2",
    percentage: 35,
    quiz: {
      lesson: {
        id: "lesson-2",
        title: "Algorithmique",
        module: {
          formationId: "formation-1",
        },
      },
    },
  });

  // Aucun parcours actif pour cet apprenant.
  mocks.learningPathFindFirst.mockResolvedValueOnce(null);

  await addQuizRevision(
    context.tenantId!,
    context.userId,
    "attempt-2",
  );

  expect(mocks.learningPathStepFindFirst).not.toHaveBeenCalled();
  expect(mocks.learningPathStepCreate).not.toHaveBeenCalled();
  expect(mocks.learningPathUpdate).not.toHaveBeenCalled();
});


it("ignore un conflit P2002 lorsqu'une révision identique existe déjà", async () => {
  mocks.quizAttemptFindFirst.mockResolvedValueOnce({
    id: "attempt-3",
    percentage: 35,
    quiz: {
      lesson: {
        id: "lesson-3",
        title: "Structures de données",
        module: {
          formationId: "formation-1",
        },
      },
    },
  });

  mocks.learningPathFindFirst.mockResolvedValueOnce({
    id: "path-1",
  });

  mocks.learningPathStepFindFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ position: 4 });

  // La création déclenche une erreur de contrainte unique.
 const prismaError = new Prisma.PrismaClientKnownRequestError(
  "Unique constraint failed",
  {
    code: "P2002",
    clientVersion: "7.10.0",
    meta: {
      target: ["tenantId", "learningPathId", "sourceAttemptId"],
    },
  },
);

  mocks.learningPathStepCreate.mockRejectedValueOnce(prismaError);

  // Après le rollback, la révision concurrente est retrouvée.
  mocks.rootLearningPathStepFindFirst.mockResolvedValueOnce({
    id: "revision-existing",
  });

  await expect(
    addQuizRevision(
      context.tenantId!,
      context.userId,
      "attempt-3",
    ),
  ).resolves.toBeUndefined();

  expect(mocks.rootLearningPathStepFindFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        tenantId: context.tenantId,
        sourceAttemptId: "attempt-3",
        stepType: "REVISION",
      }),
    }),
  );

  expect(mocks.learningPathUpdate).not.toHaveBeenCalled();
});


it("propage un conflit P2002 lorsqu'aucune révision identique n'existe", async () => {
  mocks.quizAttemptFindFirst.mockResolvedValueOnce({
    id: "attempt-4",
    percentage: 35,
    quiz: {
      lesson: {
        id: "lesson-4",
        title: "Bases de données",
        module: {
          formationId: "formation-1",
        },
      },
    },
  });

  mocks.learningPathFindFirst.mockResolvedValueOnce({
    id: "path-1",
  });

  mocks.learningPathStepFindFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ position: 4 });

  const prismaError = new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed",
    {
      code: "P2002",
      clientVersion: "7.10.0",
      meta: {
        target: ["tenantId", "learningPathId", "position"],
      },
    },
  );

  mocks.learningPathStepCreate.mockRejectedValueOnce(prismaError);

  // Aucun doublon correspondant à cette tentative.
  mocks.rootLearningPathStepFindFirst.mockResolvedValueOnce(null);

  await expect(
    addQuizRevision(
      context.tenantId!,
      context.userId,
      "attempt-4",
    ),
  ).rejects.toMatchObject({
    code: "P2002",
  });

  expect(mocks.rootLearningPathStepFindFirst).toHaveBeenCalled();
});

});
