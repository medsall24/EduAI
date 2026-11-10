
import { beforeEach, describe, expect, it, vi } from "vitest";

// Simule les méthodes Prisma utilisées par le service d'analyse.
const { userFindFirst, quizAttemptFindMany } = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  quizAttemptFindMany: vi.fn(),
}));

// Remplace Prisma par des fonctions simulées pour isoler les tests.
vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: userFindFirst,
    },
    quizAttempt: {
      findMany: quizAttemptFindMany,
    },
  },
}));

// Importe le service après la déclaration du mock Prisma.
import {
  getLearnerPerformance,
} from "../src/modules/ai/ai.performance.service.js";

// Contexte fictif d'un apprenant rattaché à un tenant.
const context = {
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "11111111-1111-4111-8111-111111111111",
  roleId: "22222222-2222-4222-8222-222222222222",
  systemRole: null,
};

// Identifiants fictifs utilisés dans les scénarios de test.
const quizId = "44444444-4444-4444-8444-444444444444";
const lessonId = "55555555-5555-4555-8555-555555555555";
const formationId = "66666666-6666-4666-8666-666666666666";
const questionId = "77777777-7777-4777-8777-777777777777";
const correctOptionId = "88888888-8888-4888-8888-888888888888";
const incorrectOptionId = "99999999-9999-4999-8999-999999999999";

/**
 * Construit une tentative fictive avec une structure identique
 * aux données sélectionnées par le service Prisma.
 *
 * Les paramètres permettent de tester différents résultats
 * sans dépendre d'une véritable base de données.
 */
function createAttempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    quizId,
    score: 8,
    percentage: 80,
    passed: true,
    startedAt: new Date("2026-11-01T10:00:00.000Z"),
    completedAt: new Date("2026-11-01T10:15:00.000Z"),
    quiz: {
      id: quizId,
      title: "Quiz de programmation",
      passingScore: 50,
      lesson: {
        id: lessonId,
        title: "Les variables",
        module: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          title: "Introduction à la programmation",
          formation: {
            id: formationId,
            title: "Développement informatique",
          },
        },
      },
      questions: [
        {
          id: questionId,
          text: "Qu'est-ce qu'une variable ?",
          type: "SINGLE_CHOICE",
          points: 1,
          options: [
            {
              id: correctOptionId,
              isCorrect: true,
            },
            {
              id: incorrectOptionId,
              isCorrect: false,
            },
          ],
        },
      ],
    },
    answers: [
      {
        questionId,
        optionId: correctOptionId,
      },
    ],
    ...overrides,
  };
}

describe("AI performance service", () => {
  beforeEach(() => {
    // Réinitialise les appels simulés avant chaque test.
    vi.clearAllMocks();

    // Simule un utilisateur actif possédant le rôle APPRENANT.
    userFindFirst.mockResolvedValue({
      role: {
        name: "APPRENANT",
      },
    });

    // Simule l'absence de tentative terminée.
    quizAttemptFindMany.mockResolvedValue([]);
  });

  it("refuse l'accès lorsque le contexte tenant est absent", async () => {
    await expect(
      getLearnerPerformance({
        ...context,
        tenantId: null,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Tenant context is required",
    });

    // Aucune requête Prisma ne doit être exécutée.
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(quizAttemptFindMany).not.toHaveBeenCalled();
  });

  it("refuse l'accès à SUPER_ADMIN", async () => {
    await expect(
      getLearnerPerformance({
        ...context,
        systemRole: "SUPER_ADMIN",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Performance analysis is not available for this role",
    });

    expect(userFindFirst).not.toHaveBeenCalled();
    expect(quizAttemptFindMany).not.toHaveBeenCalled();
  });

  it("refuse l'accès à un utilisateur qui n'est pas apprenant", async () => {
    // Simule un utilisateur possédant le rôle FORMATEUR.
    userFindFirst.mockResolvedValueOnce({
      role: {
        name: "FORMATEUR",
      },
    });

    await expect(
      getLearnerPerformance(context),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only learners can access their performance analysis",
    });

    expect(userFindFirst).toHaveBeenCalledOnce();
    expect(quizAttemptFindMany).not.toHaveBeenCalled();
  });

  it("refuse l'accès si l'utilisateur est introuvable ou inactif", async () => {
    // Simule un utilisateur absent du tenant ou non actif.
    userFindFirst.mockResolvedValueOnce(null);

    await expect(
      getLearnerPerformance(context),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only learners can access their performance analysis",
    });

    expect(quizAttemptFindMany).not.toHaveBeenCalled();
  });

  it("retourne une structure vide sans tentative terminée", async () => {
    const result = await getLearnerPerformance(context);

    expect(result.summary).toEqual({
      totalAttempts: 0,
      totalQuizzes: 0,
      averagePercentage: 0,
      successRate: 0,
      passedAttempts: 0,
      failedAttempts: 0,
    });

    expect(result.performanceByQuiz).toEqual([]);
    expect(result.performanceByLesson).toEqual([]);
    expect(result.performanceByFormation).toEqual([]);

    expect(result.questionAnalysis).toEqual({
      totalEvaluations: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      unansweredQuestions: 0,
      strengths: [],
      difficulties: [],
    });

    expect(result.generatedAt).toBeTypeOf("string");
  });

  it("utilise exclusivement le tenant et l'utilisateur authentifiés", async () => {
    await getLearnerPerformance(context);

    // Vérifie la recherche de l'utilisateur dans son tenant.
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

    // Vérifie que les tentatives sont limitées à l'utilisateur et au tenant.
    expect(quizAttemptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: context.tenantId,
          userId: context.userId,
          completedAt: {
            not: null,
          },
        },
        orderBy: {
          completedAt: "desc",
        },
      }),
    );
  });

  it("calcule correctement les statistiques d'une tentative réussie", async () => {
    quizAttemptFindMany.mockResolvedValueOnce([
      createAttempt(),
    ]);

    const result = await getLearnerPerformance(context);

    expect(result.summary).toEqual({
      totalAttempts: 1,
      totalQuizzes: 1,
      averagePercentage: 80,
      successRate: 100,
      passedAttempts: 1,
      failedAttempts: 0,
    });

    expect(result.performanceByQuiz).toHaveLength(1);
    expect(result.performanceByQuiz[0].quizId).toBe(quizId);
    expect(result.performanceByQuiz[0].averagePercentage).toBe(80);
    expect(result.performanceByQuiz[0].successRate).toBe(100);

    expect(result.performanceByLesson[0].lessonId).toBe(lessonId);
    expect(result.performanceByFormation[0].formationId).toBe(formationId);
  });

  it("identifie une réponse correcte", async () => {
    quizAttemptFindMany.mockResolvedValueOnce([
      createAttempt(),
    ]);

    const result = await getLearnerPerformance(context);

    expect(result.questionAnalysis.totalEvaluations).toBe(1);
    expect(result.questionAnalysis.correctAnswers).toBe(1);
    expect(result.questionAnalysis.incorrectAnswers).toBe(0);
    expect(result.questionAnalysis.unansweredQuestions).toBe(0);

    expect(result.questionAnalysis.strengths).toHaveLength(1);
    expect(result.questionAnalysis.strengths[0].questionId).toBe(
      questionId,
    );
  });

  it("identifie une réponse incorrecte", async () => {
    const attempt = createAttempt({
      answers: [
        {
          questionId,
          optionId: incorrectOptionId,
        },
      ],
    });

    quizAttemptFindMany.mockResolvedValueOnce([attempt]);

    const result = await getLearnerPerformance(context);

    expect(result.questionAnalysis.correctAnswers).toBe(0);
    expect(result.questionAnalysis.incorrectAnswers).toBe(1);
    expect(result.questionAnalysis.unansweredQuestions).toBe(0);

    expect(result.questionAnalysis.difficulties).toHaveLength(1);
    expect(result.questionAnalysis.difficulties[0].successRate).toBe(0);
  });

  it("comptabilise une question sans réponse comme non répondue et incorrecte", async () => {
    // Une question sans réponse ne possède aucune ligne QuizAnswer.
    const attempt = createAttempt({
      answers: [],
    });

    quizAttemptFindMany.mockResolvedValueOnce([attempt]);

    const result = await getLearnerPerformance(context);

    expect(result.questionAnalysis.totalEvaluations).toBe(1);
    expect(result.questionAnalysis.correctAnswers).toBe(0);
    expect(result.questionAnalysis.incorrectAnswers).toBe(0);
    expect(result.questionAnalysis.unansweredQuestions).toBe(1);

    expect(result.questionAnalysis.difficulties).toHaveLength(1);
  });

  it("exige une correspondance exacte pour une réponse à choix multiples", async () => {
    const secondCorrectOptionId =
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    const attempt = createAttempt({
      quiz: {
        ...createAttempt().quiz,
        questions: [
          {
            ...createAttempt().quiz.questions[0],
            type: "MULTIPLE_CHOICE",
            options: [
              {
                id: correctOptionId,
                isCorrect: true,
              },
              {
                id: secondCorrectOptionId,
                isCorrect: true,
              },
              {
                id: incorrectOptionId,
                isCorrect: false,
              },
            ],
          },
        ],
      },
      answers: [
        {
          questionId,
          optionId: correctOptionId,
        },
      ],
    });

    // Une seule option correcte sélectionnée sur deux : la réponse est incorrecte.
    quizAttemptFindMany.mockResolvedValueOnce([attempt]);

    const result = await getLearnerPerformance(context);

    expect(result.questionAnalysis.correctAnswers).toBe(0);
    expect(result.questionAnalysis.incorrectAnswers).toBe(1);
  });

  it("reconnaît une réponse multiple lorsque toutes les options correctes sont sélectionnées", async () => {
    const secondCorrectOptionId =
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    const baseAttempt = createAttempt();

    const attempt = {
      ...baseAttempt,
      quiz: {
        ...baseAttempt.quiz,
        questions: [
          {
            ...baseAttempt.quiz.questions[0],
            type: "MULTIPLE_CHOICE",
            options: [
              {
                id: correctOptionId,
                isCorrect: true,
              },
              {
                id: secondCorrectOptionId,
                isCorrect: true,
              },
              {
                id: incorrectOptionId,
                isCorrect: false,
              },
            ],
          },
        ],
      },
      answers: [
        {
          questionId,
          optionId: correctOptionId,
        },
        {
          questionId,
          optionId: secondCorrectOptionId,
        },
      ],
    };

    quizAttemptFindMany.mockResolvedValueOnce([attempt]);

    const result = await getLearnerPerformance(context);

    expect(result.questionAnalysis.correctAnswers).toBe(1);
    expect(result.questionAnalysis.incorrectAnswers).toBe(0);
  });

  it("considère une sélection contenant une option incorrecte comme incorrecte", async () => {
    const attempt = createAttempt({
      answers: [
        {
          questionId,
          optionId: correctOptionId,
        },
        {
          questionId,
          optionId: incorrectOptionId,
        },
      ],
    });

    quizAttemptFindMany.mockResolvedValueOnce([attempt]);

    const result = await getLearnerPerformance(context);

    expect(result.questionAnalysis.correctAnswers).toBe(0);
    expect(result.questionAnalysis.incorrectAnswers).toBe(1);
  });

  it("conserve plusieurs tentatives du même quiz dans les statistiques", async () => {
    const firstAttempt = createAttempt({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      percentage: 40,
      passed: false,
      answers: [
        {
          questionId,
          optionId: incorrectOptionId,
        },
      ],
    });

    const secondAttempt = createAttempt({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      percentage: 80,
      passed: true,
    });

    quizAttemptFindMany.mockResolvedValueOnce([
      secondAttempt,
      firstAttempt,
    ]);

    const result = await getLearnerPerformance(context);

    expect(result.summary.totalAttempts).toBe(2);
    expect(result.summary.totalQuizzes).toBe(1);
    expect(result.summary.averagePercentage).toBe(60);
    expect(result.summary.passedAttempts).toBe(1);
    expect(result.summary.failedAttempts).toBe(1);

    expect(result.performanceByQuiz[0].attempts).toBe(2);
    expect(result.performanceByQuiz[0].averagePercentage).toBe(60);

    expect(result.questionAnalysis.totalEvaluations).toBe(2);
    expect(result.questionAnalysis.correctAnswers).toBe(1);
    expect(result.questionAnalysis.incorrectAnswers).toBe(1);
  });

  it("ne compte pas les questions sans option correcte comme réussies", async () => {
    const baseAttempt = createAttempt();

    const attempt = {
      ...baseAttempt,
      quiz: {
        ...baseAttempt.quiz,
        questions: [
          {
            ...baseAttempt.quiz.questions[0],
            options: [
              {
                id: correctOptionId,
                isCorrect: false,
              },
              {
                id: incorrectOptionId,
                isCorrect: false,
              },
            ],
          },
        ],
      },
    };

    quizAttemptFindMany.mockResolvedValueOnce([attempt]);

    const result = await getLearnerPerformance(context);

    expect(result.questionAnalysis.correctAnswers).toBe(0);
    expect(result.questionAnalysis.incorrectAnswers).toBe(1);
  });

  it("retourne les résultats officiels sans recalculer le score enregistré", async () => {
    const attempt = createAttempt({
      score: 7.5,
      percentage: 75,
      passed: true,
    });

    quizAttemptFindMany.mockResolvedValueOnce([attempt]);

    const result = await getLearnerPerformance(context);

    expect(result.attempts[0]).toMatchObject({
      score: 7.5,
      percentage: 75,
      passed: true,
    });

    expect(result.summary.averagePercentage).toBe(75);
  });
});
