
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";

/**
 * Contexte minimal nécessaire à l'analyse des performances.
 *
 * Les informations d'identité et de tenant proviennent exclusivement
 * du middleware d'authentification, jamais du corps de la requête.
 */
export type AIPerformanceContext = {
  userId: string;
  tenantId: string | null;
  roleId: string | null;
  systemRole: "SUPER_ADMIN" | null;
};

/**
 * Vérifie que l'utilisateur possède un contexte tenant valide.
 *
 * L'analyse des performances est une fonctionnalité personnelle :
 * elle n'est pas accessible aux comptes sans tenant ni à SUPER_ADMIN.
 */
function ensureTenantContext(context: AIPerformanceContext): string {
  if (!context.userId) {
    throw new AppError(401, "Authentication is required");
  }

  if (!context.tenantId) {
    throw new AppError(403, "Tenant context is required");
  }

  if (!context.roleId || context.systemRole === "SUPER_ADMIN") {
    throw new AppError(
      403,
      "Performance analysis is not available for this role",
    );
  }

  return context.tenantId;
}

/**
 * Vérifie le rôle réel de l'utilisateur dans son tenant.
 *
 * Le rôle n'est pas considéré comme fiable lorsqu'il provient uniquement
 * du JWT : il est vérifié à nouveau dans la base de données.
 */
async function ensureLearner(
  context: AIPerformanceContext,
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
      "Only learners can access their performance analysis",
    );
  }
}

/**
 * Vérifie si deux ensembles d'identifiants sont strictement identiques.
 *
 * Cette comparaison reproduit la règle métier du service de quiz :
 * une réponse est correcte uniquement si toutes les options correctes
 * sont sélectionnées et qu'aucune option incorrecte n'est sélectionnée.
 */
function hasSameOptionIds(
  selectedOptionIds: string[],
  correctOptionIds: string[],
): boolean {
  if (correctOptionIds.length === 0) {
    return false;
  }

  if (selectedOptionIds.length !== correctOptionIds.length) {
    return false;
  }

  const selected = new Set(selectedOptionIds);
  const correct = new Set(correctOptionIds);

  return (
    selected.size === correct.size &&
    [...correct].every((optionId) => selected.has(optionId))
  );
}


/**
 * Calcule un pourcentage à partir d'un numérateur et d'un dénominateur.
 * Utilisé pour les taux de réussite et les proportions.
 */
function calculatePercentage(
  numerator: number,
  denominator: number,
): number {
  if (denominator <= 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

/**
 * Calcule la moyenne de valeurs déjà exprimées en pourcentage.
 * Ne multiplie pas le résultat par 100 une seconde fois.
 */
function calculateAverage(
  total: number,
  count: number,
): number {
  if (count <= 0) {
    return 0;
  }

  return Number((total / count).toFixed(2));
}


/**
 * Analyse les performances pédagogiques d'un apprenant.
 *
 * Règles métier :
 * - seules les tentatives terminées sont analysées ;
 * - les données sont isolées par tenant et par utilisateur ;
 * - les scores officiels proviennent directement de QuizAttempt ;
 * - les questions non répondues sont comptabilisées comme incorrectes ;
 * - les réponses multiples sont évaluées par comparaison exacte des options ;
 * - aucune API IA externe n'est appelée.
 */
export async function getLearnerPerformance(
  context: AIPerformanceContext,
) {
  const tenantId = ensureTenantContext(context);

  // Vérifie les droits métier avant toute lecture des résultats.
  await ensureLearner(context, tenantId);

  // Charge uniquement les tentatives terminées de l'apprenant authentifié.
  const attempts = await prisma.quizAttempt.findMany({
    where: {
      tenantId,
      userId: context.userId,
      completedAt: {
        not: null,
      },
    },
    orderBy: {
      completedAt: "desc",
    },
    select: {
      id: true,
      quizId: true,
      score: true,
      percentage: true,
      passed: true,
      startedAt: true,
      completedAt: true,

      quiz: {
        select: {
          id: true,
          title: true,
          passingScore: true,

          lesson: {
            select: {
              id: true,
              title: true,

              module: {
                select: {
                  id: true,
                  title: true,

                  formation: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },

          questions: {
            where: {
              tenantId,
            },
            orderBy: {
              position: "asc",
            },
            select: {
              id: true,
              text: true,
              type: true,
              points: true,
              options: {
                where: {
                  tenantId,
                },
                select: {
                  id: true,
                  isCorrect: true,
                },
              },
            },
          },
        },
      },

      // Récupère les options réellement enregistrées pour chaque tentative.
      answers: {
        where: {
          tenantId,
        },
        select: {
          questionId: true,
          optionId: true,
        },
      },
    },
  });

  // Retourne une structure cohérente si aucune tentative n'est terminée.
  if (attempts.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalAttempts: 0,
        totalQuizzes: 0,
        averagePercentage: 0,
        successRate: 0,
        passedAttempts: 0,
        failedAttempts: 0,
      },
      performanceByQuiz: [],
      performanceByLesson: [],
      performanceByFormation: [],
      questionAnalysis: {
        totalEvaluations: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        unansweredQuestions: 0,
        strengths: [],
        difficulties: [],
      },
      attempts: [],
    };
  }

  // Prépare les structures d'agrégation des résultats.
  const quizStats = new Map<
    string,
    {
      quizId: string;
      quizTitle: string;
      lessonId: string;
      lessonTitle: string;
      formationId: string;
      formationTitle: string;
      attempts: number;
      totalPercentage: number;
      passedAttempts: number;
      totalScore: number;
    }
  >();

  const lessonStats = new Map<
    string,
    {
      lessonId: string;
      lessonTitle: string;
      formationId: string;
      formationTitle: string;
      attempts: number;
      totalPercentage: number;
      passedAttempts: number;
    }
  >();

  const formationStats = new Map<
    string,
    {
      formationId: string;
      formationTitle: string;
      attempts: number;
      totalPercentage: number;
      passedAttempts: number;
    }
  >();

  const questionStats = new Map<
    string,
    {
      questionId: string;
      questionText: string;
      questionType: string;
      quizId: string;
      quizTitle: string;
      lessonId: string;
      lessonTitle: string;
      formationId: string;
      formationTitle: string;
      attempts: number;
      correctAnswers: number;
      incorrectAnswers: number;
      unansweredQuestions: number;
    }
  >();

  let totalPercentage = 0;
  let passedAttempts = 0;
  let totalEvaluations = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let unansweredQuestions = 0;

  // Analyse chaque tentative indépendamment, sans écraser l'historique.
  for (const attempt of attempts) {
    const quiz = attempt.quiz;
    const lesson = quiz.lesson;
    const formation = lesson.module.formation;

    totalPercentage += attempt.percentage;

    if (attempt.passed) {
      passedAttempts += 1;
    }

    // Prépare les statistiques du quiz.
    const quizStat = quizStats.get(quiz.id) ?? {
      quizId: quiz.id,
      quizTitle: quiz.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      formationId: formation.id,
      formationTitle: formation.title,
      attempts: 0,
      totalPercentage: 0,
      passedAttempts: 0,
      totalScore: 0,
    };

    quizStat.attempts += 1;
    quizStat.totalPercentage += attempt.percentage;
    quizStat.totalScore += attempt.score;

    if (attempt.passed) {
      quizStat.passedAttempts += 1;
    }

    quizStats.set(quiz.id, quizStat);

    // Prépare les statistiques de la leçon.
    const lessonStat = lessonStats.get(lesson.id) ?? {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      formationId: formation.id,
      formationTitle: formation.title,
      attempts: 0,
      totalPercentage: 0,
      passedAttempts: 0,
    };

    lessonStat.attempts += 1;
    lessonStat.totalPercentage += attempt.percentage;

    if (attempt.passed) {
      lessonStat.passedAttempts += 1;
    }

    lessonStats.set(lesson.id, lessonStat);

    // Prépare les statistiques de la formation.
    const formationStat = formationStats.get(formation.id) ?? {
      formationId: formation.id,
      formationTitle: formation.title,
      attempts: 0,
      totalPercentage: 0,
      passedAttempts: 0,
    };

    formationStat.attempts += 1;
    formationStat.totalPercentage += attempt.percentage;

    if (attempt.passed) {
      formationStat.passedAttempts += 1;
    }

    formationStats.set(formation.id, formationStat);

    // Regroupe les réponses enregistrées par identifiant de question.
    const answersByQuestion = new Map<string, string[]>();

    for (const answer of attempt.answers) {
      const selectedOptions =
        answersByQuestion.get(answer.questionId) ?? [];

      selectedOptions.push(answer.optionId);

      answersByQuestion.set(answer.questionId, selectedOptions);
    }

    // Évalue toutes les questions, y compris celles sans réponse enregistrée.
    for (const question of quiz.questions) {
      const selectedOptionIds =
        answersByQuestion.get(question.id) ?? [];

      const correctOptionIds = question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id);

      const isUnanswered = selectedOptionIds.length === 0;

      const isCorrect =
        !isUnanswered &&
        hasSameOptionIds(selectedOptionIds, correctOptionIds);

      totalEvaluations += 1;

      if (isUnanswered) {
        unansweredQuestions += 1;
      } else if (isCorrect) {
        correctAnswers += 1;
      } else {
        incorrectAnswers += 1;
      }

      // Une question est identifiée par son ID, indépendamment des tentatives.
      const questionStat = questionStats.get(question.id) ?? {
        questionId: question.id,
        questionText: question.text,
        questionType: question.type,
        quizId: quiz.id,
        quizTitle: quiz.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        formationId: formation.id,
        formationTitle: formation.title,
        attempts: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        unansweredQuestions: 0,
      };

      questionStat.attempts += 1;

      if (isUnanswered) {
        questionStat.unansweredQuestions += 1;
      } else if (isCorrect) {
        questionStat.correctAnswers += 1;
      } else {
        questionStat.incorrectAnswers += 1;
      }

      questionStats.set(question.id, questionStat);
    }
  }

  // Calcule les taux de réussite et les moyennes par quiz.
  const performanceByQuiz = [...quizStats.values()].map((stat) => ({
    ...stat,
   averagePercentage: calculateAverage(
  stat.totalPercentage,
  stat.attempts,
),
    successRate: calculatePercentage(
      stat.passedAttempts,
      stat.attempts,
    ),
  }));

  // Calcule les moyennes par leçon.
  const performanceByLesson = [...lessonStats.values()].map((stat) => ({
    ...stat,
    averagePercentage: calculateAverage(
  stat.totalPercentage,
  stat.attempts,
),
    successRate: calculatePercentage(
      stat.passedAttempts,
      stat.attempts,
    ),
  }));

  // Calcule les moyennes par formation.
  const performanceByFormation = [...formationStats.values()].map(
    (stat) => ({
      ...stat,
      averagePercentage: calculateAverage(
  stat.totalPercentage,
  stat.attempts,
),
      successRate: calculatePercentage(
        stat.passedAttempts,
        stat.attempts,
      ),
    }),
  );

  // Transforme les statistiques des questions en taux de réussite.
  const analyzedQuestions = [...questionStats.values()].map((stat) => ({
    ...stat,
    successRate: calculatePercentage(
      stat.correctAnswers,
      stat.attempts,
    ),
  }));

  // Identifie les points forts et les difficultés à partir des résultats.
  const strengths = analyzedQuestions
    .filter((question) => question.successRate >= 80)
    .sort((a, b) => b.successRate - a.successRate);

  const difficulties = analyzedQuestions
    .filter((question) => question.successRate < 60)
    .sort((a, b) => a.successRate - b.successRate);

  // Retourne les résultats officiels et les analyses détaillées.
  return {
    generatedAt: new Date().toISOString(),

    summary: {
      totalAttempts: attempts.length,
      totalQuizzes: quizStats.size,
      averagePercentage: calculateAverage(
  totalPercentage,
  attempts.length,
),
      successRate: calculatePercentage(
        passedAttempts,
        attempts.length,
      ),
      passedAttempts,
      failedAttempts: attempts.length - passedAttempts,
    },

    performanceByQuiz,
    performanceByLesson,
    performanceByFormation,

    questionAnalysis: {
      totalEvaluations,
      correctAnswers,
      incorrectAnswers,
      unansweredQuestions,
      strengths,
      difficulties,
    },

    attempts: attempts.map((attempt) => ({
      attemptId: attempt.id,
      quizId: attempt.quizId,
      quizTitle: attempt.quiz.title,
      lessonTitle: attempt.quiz.lesson.title,
      formationTitle: attempt.quiz.lesson.module.formation.title,
      score: attempt.score,
      percentage: attempt.percentage,
      passed: attempt.passed,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    })),
  };
}
