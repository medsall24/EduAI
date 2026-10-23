import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import type {
  CreateOptionInput,
  UpdateOptionInput,
  SubmitQuizInput,
} from "./quiz.schema.js";
/**
 * Contexte de sécurité transmis au service.
 *
 * Le tenantId provient du JWT de l'utilisateur authentifié.
 * Il n'est jamais récupéré depuis les données envoyées par le client.
 */
type TenantContext = {
  userId: string;
  tenantId: string | null;
  roleId: string | null;
  systemRole: "SUPER_ADMIN" | null;
};

/**
 * Données nécessaires à la création d'un Quiz.
 */
type CreateQuizInput = {
  title: string;
  description?: string;
  duration?: number;
  passingScore?: number;
  isActive?: boolean;
};

/**
 * Données pouvant être modifiées lors de la mise à jour d'un Quiz.
 */
type UpdateQuizInput = {
  title?: string;
  description?: string | null;
  duration?: number | null;
  passingScore?: number;
  isActive?: boolean;
};

/**
 * Vérifie que la requête possède un contexte tenant valide.
 *
 * Un utilisateur normal doit obligatoirement être rattaché
 * à un tenant afin de pouvoir manipuler une ressource tenant-scoped.
 */
function ensureTenantContext(context: TenantContext): string {
  if (!context.tenantId) {
    throw new AppError(403, "Tenant context is required");
  }

  return context.tenantId;
}

/**
 * Vérifie que la Lesson appartient au tenant courant.
 *
 * Cette vérification est essentielle pour empêcher un utilisateur
 * d'un tenant d'attacher un Quiz à une Lesson d'un autre tenant.
 */
async function ensureLessonBelongsToTenant(
  lessonId: string,
  tenantId: string,
) {
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      tenantId,
    },
  });

  if (!lesson) {
    throw new AppError(400, "Lesson not found in this tenant");
  }

  return lesson;
}

/**
 * Crée un nouveau Quiz pour une Lesson appartenant
 * au tenant courant.
 */
export async function createQuiz(
  context: TenantContext,
  lessonId: string,
  input: CreateQuizInput,
) {
  const tenantId = ensureTenantContext(context);

  // Vérifie que la Lesson appartient au tenant courant.
  await ensureLessonBelongsToTenant(lessonId, tenantId);

  return prisma.quiz.create({
    data: {
      tenantId,
      lessonId,
      title: input.title,
      description: input.description,
      duration: input.duration,
      passingScore: input.passingScore ?? 50,
      isActive: input.isActive ?? true,
    },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          moduleId: true,
        },
      },
    },
  });
}

/**
 * Retourne tous les Quiz associés à une Lesson
 * appartenant au tenant courant.
 */
export async function listQuizzes(
  context: TenantContext,
  lessonId: string,
) {
  const tenantId = ensureTenantContext(context);

  // Vérifie l'appartenance de la Lesson au tenant.
  await ensureLessonBelongsToTenant(lessonId, tenantId);

  return prisma.quiz.findMany({
    where: {
      tenantId,
      lessonId,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          moduleId: true,
        },
      },
    },
  });
}

/**
 * Récupère un Quiz appartenant au tenant courant.
 *
 * Les questions sont incluses dans la réponse pour permettre
 * la consultation complète du Quiz par les utilisateurs autorisés.
 *
 * Les options sont également retournées, mais la propriété
 * isCorrect devra être masquée côté contrôleur/service
 * pour les utilisateurs apprenants lors de la consommation
 * du Quiz.
 */
export async function getQuiz(
  context: TenantContext,
  id: string,
) {
  const tenantId = ensureTenantContext(context);

  /**
   * Le SUPER_ADMIN possède un accès global et peut consulter
   * les réponses correctes.
   */
  let canRevealCorrectAnswers =
    context.systemRole === "SUPER_ADMIN";

  /**
   * Pour un utilisateur rattaché à un tenant, le rôle est
   * recherché avec le tenantId afin d'éviter toute confusion
   * entre deux rôles portant le même nom dans des tenants différents.
   */
  if (!canRevealCorrectAnswers && context.roleId) {
    const role = await prisma.role.findFirst({
      where: {
        id: context.roleId,
        tenantId,
      },
      select: {
        name: true,
      },
    });

    canRevealCorrectAnswers =
      role?.name === "TENANT_ADMIN" ||
      role?.name === "FORMATEUR";
  }

  const quiz = await prisma.quiz.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          moduleId: true,
        },
      },
      questions: {
        orderBy: {
          position: "asc",
        },
        include: {
          options: {
            orderBy: {
              position: "asc",
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  /**
   * Les utilisateurs autorisés à gérer les Quiz peuvent voir
   * les réponses correctes.
   */
  if (canRevealCorrectAnswers) {
    return quiz;
  }

  /**
   * Pour les apprenants, le champ isCorrect est explicitement
   * retiré de chaque option avant l'envoi de la réponse HTTP.
   */
  return {
    ...quiz,
    questions: quiz.questions.map((question) => ({
      ...question,
      options: question.options.map(
        ({ isCorrect: _isCorrect, ...option }) => option,
      ),
    })),
  };
}

/**
 * Met à jour un Quiz appartenant au tenant courant.
 */
export async function updateQuiz(
  context: TenantContext,
  id: string,
  input: UpdateQuizInput,
) {
  const tenantId = ensureTenantContext(context);

  // Recherche uniquement dans le tenant courant.
  const existingQuiz = await prisma.quiz.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!existingQuiz) {
    throw new AppError(404, "Quiz not found");
  }

  return prisma.quiz.update({
    where: {
      id,
      tenantId,
    },
    data: {
      ...(input.title !== undefined
        ? { title: input.title }
        : {}),

      ...(input.description !== undefined
        ? { description: input.description }
        : {}),

      ...(input.duration !== undefined
        ? { duration: input.duration }
        : {}),

      ...(input.passingScore !== undefined
        ? { passingScore: input.passingScore }
        : {}),

      ...(input.isActive !== undefined
        ? { isActive: input.isActive }
        : {}),
    },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          moduleId: true,
        },
      },
    },
  });
}

/**
 * Supprime un Quiz appartenant au tenant courant.
 *
 * Les relations configurées avec onDelete: Cascade dans Prisma
 * permettent également de supprimer les questions/options
 * et autres données dépendantes selon les relations définies
 * dans le schéma.
 */
export async function deleteQuiz(
  context: TenantContext,
  id: string,
) {
  const tenantId = ensureTenantContext(context);

  // Vérifie que le Quiz appartient bien au tenant.
  const existingQuiz = await prisma.quiz.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!existingQuiz) {
    throw new AppError(404, "Quiz not found");
  }

  return prisma.quiz.delete({
    where: {
      id,
      tenantId,
    },
  });
}

/**
 * Données nécessaires à la création d'une Question.
 */
type CreateQuestionInput = {
  text: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  points?: number;
  position: number;
};

/**
 * Données pouvant être modifiées lors de la mise à jour
 * d'une Question.
 */
type UpdateQuestionInput = {
  text?: string;
  type?: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  points?: number;
  position?: number;
};

/**
 * Vérifie qu'un Quiz appartient bien au tenant courant.
 */
async function ensureQuizBelongsToTenant(
  quizId: string,
  tenantId: string,
) {
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      tenantId,
    },
  });

  if (!quiz) {
    throw new AppError(404, "Quiz not found");
  }

  return quiz;
}


/**
 * Détermine si le contexte courant peut consulter les bonnes réponses.
 */
async function canRevealCorrectAnswers(
  context: TenantContext,
): Promise<boolean> {
  if (context.systemRole === "SUPER_ADMIN") {
    return true;
  }

  const tenantId = ensureTenantContext(context);

  if (!context.roleId) {
    return false;
  }

  const role = await prisma.role.findFirst({
    where: {
      id: context.roleId,
      tenantId,
    },
    select: {
      name: true,
    },
  });

  return (
    role?.name === "TENANT_ADMIN" ||
    role?.name === "FORMATEUR"
  );
}

/**
 * Masque isCorrect lorsque le contexte n'est pas autorisé.
 */
function sanitizeQuestion<T extends {
  options: Array<{ isCorrect: boolean } & Record<string, unknown>>;
}>(
  question: T,
  revealCorrectAnswers: boolean,
) {
  if (revealCorrectAnswers) {
    return question;
  }

  return {
    ...question,
    options: question.options.map(
      ({ isCorrect: _isCorrect, ...option }) => option,
    ),
  };
}


/**
 * Crée une Question dans un Quiz appartenant
 * au tenant courant.
 */
export async function createQuestion(
  context: TenantContext,
  quizId: string,
  input: CreateQuestionInput,
) {
  const tenantId = ensureTenantContext(context);

  await ensureQuizBelongsToTenant(quizId, tenantId);

  const existingQuestion = await prisma.question.findFirst({
    where: {
      tenantId,
      quizId,
      position: input.position,
    },
  });

  if (existingQuestion) {
    throw new AppError(
      409,
      "A question already exists at this position",
    );
  }

    const question = await prisma.question.create({
    data: {
      tenantId,
      quizId,
      text: input.text,
      type: input.type,
      points: input.points ?? 1,
      position: input.position,
    },
    include: {
      options: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  const revealCorrectAnswers =
    await canRevealCorrectAnswers(context);

  return sanitizeQuestion(question, revealCorrectAnswers);
}

/**
 * Retourne toutes les Questions d'un Quiz
 * appartenant au tenant courant.
 */
export async function listQuestions(
  context: TenantContext,
  quizId: string,
) {
  const tenantId = ensureTenantContext(context);

  await ensureQuizBelongsToTenant(quizId, tenantId);


  const questions = await prisma.question.findMany({
    where: {
      tenantId,
      quizId,
    },
    orderBy: {
      position: "asc",
    },
    include: {
      options: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  const revealCorrectAnswers =
    await canRevealCorrectAnswers(context);

  return questions.map((question) =>
    sanitizeQuestion(question, revealCorrectAnswers),
  );

}

/**
 * Met à jour une Question appartenant au tenant courant.
 */
export async function updateQuestion(
  context: TenantContext,
  questionId: string,
  input: UpdateQuestionInput,
) {
  const tenantId = ensureTenantContext(context);

  const existingQuestion = await prisma.question.findFirst({
    where: {
      id: questionId,
      tenantId,
    },
  });

  if (!existingQuestion) {
    throw new AppError(404, "Question not found");
  }

  if (input.position !== undefined) {
    const positionConflict = await prisma.question.findFirst({
      where: {
        tenantId,
        quizId: existingQuestion.quizId,
        position: input.position,
        id: {
          not: questionId,
        },
      },
    });

    if (positionConflict) {
      throw new AppError(
        409,
        "A question already exists at this position",
      );
    }
  }


  const question = await prisma.question.update({
    where: {
      id: questionId,
      tenantId,
    },
    data: {
      ...(input.text !== undefined
        ? { text: input.text }
        : {}),

      ...(input.type !== undefined
        ? { type: input.type }
        : {}),

      ...(input.points !== undefined
        ? { points: input.points }
        : {}),

      ...(input.position !== undefined
        ? { position: input.position }
        : {}),
    },
    include: {
      options: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  const revealCorrectAnswers =
    await canRevealCorrectAnswers(context);

  return sanitizeQuestion(question, revealCorrectAnswers);

}

/**
 * Supprime une Question appartenant au tenant courant.
 */
export async function deleteQuestion(
  context: TenantContext,
  questionId: string,
) {
  const tenantId = ensureTenantContext(context);

  const existingQuestion = await prisma.question.findFirst({
    where: {
      id: questionId,
      tenantId,
    },
  });

  if (!existingQuestion) {
    throw new AppError(404, "Question not found");
  }

  return prisma.question.delete({
    where: {
      id: questionId,
      tenantId,
    },
  });
}


/**
 * Masque la propriété isCorrect lorsqu'un utilisateur n'est pas autorisé
 * à consulter les réponses correctes.
 *
 * Cette fonction évite d'exposer la correction aux apprenants.
 */
function sanitizeOption<T extends { isCorrect: boolean }>(
  option: T,
  revealCorrectAnswers: boolean,
) {
  // Les utilisateurs autorisés reçoivent l'option avec sa correction.
  if (revealCorrectAnswers) {
    return option;
  }

  // On retire isCorrect de l'objet retourné au client.
  const { isCorrect: _isCorrect, ...safeOption } = option;

  return safeOption;
}

/**
 * Crée une option pour une question.
 *
 * Vérifie que la question appartient au tenant connecté et empêche
 * deux options d'une même question d'avoir la même position.
 */
export async function createOption(
  context: TenantContext,
  questionId: string,
  input: CreateOptionInput,
) {
  // Récupère le tenant du contexte d'authentification.
  const tenantId = ensureTenantContext(context);

  // Détermine si l'utilisateur peut consulter les réponses correctes.
  const revealCorrectAnswers = await canRevealCorrectAnswers(context);

  // Vérifie que la question existe dans le tenant courant.
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      tenantId,
    },
    select: {
      id: true,
    },
  });

  // Ne révèle pas l'existence d'une question appartenant à un autre tenant.
  if (!question) {
    throw new AppError(404, "Question not found");
  }

  // Vérifie si la position demandée est déjà utilisée pour cette question.
  const existingOption = await prisma.option.findFirst({
    where: {
      tenantId,
      questionId,
      position: input.position,
    },
    select: {
      id: true,
    },
  });

  // Retourne un conflit si une option occupe déjà cette position.
  if (existingOption) {
    throw new AppError(409, "An option already exists at this position");
  }

  // Enregistre l'option en utilisant le tenant issu du contexte sécurisé.
  const option = await prisma.option.create({
    data: {
      tenantId,
      questionId,
      text: input.text,
      // Une option est considérée incorrecte si aucune valeur n'est fournie.
      isCorrect: input.isCorrect ?? false,
      position: input.position,
    },
  });

  // Filtre la correction si le rôle de l'utilisateur ne permet pas de la voir.
  return sanitizeOption(option, revealCorrectAnswers);
}

/**
 * Récupère toutes les options d'une question.
 *
 * Les options sont triées par position et filtrées selon les droits
 * de consultation des réponses correctes.
 */
export async function listOptions(
  context: TenantContext,
  questionId: string,
) {
  // Vérifie que le contexte contient un tenant valide.
  const tenantId = ensureTenantContext(context);

  // Vérifie les droits d'accès aux corrections.
  const revealCorrectAnswers = await canRevealCorrectAnswers(context);

  // Vérifie que la question appartient au tenant courant.
  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      tenantId,
    },
    select: {
      id: true,
    },
  });

  // Une question absente ou appartenant à un autre tenant renvoie 404.
  if (!question) {
    throw new AppError(404, "Question not found");
  }

  // Récupère uniquement les options associées à cette question et à ce tenant.
  const options = await prisma.option.findMany({
    where: {
      tenantId,
      questionId,
    },
    orderBy: {
      // Présente les options dans l'ordre prévu pour le quiz.
      position: "asc",
    },
  });

  // Applique le filtrage des corrections à chaque option.
  return options.map((option) =>
    sanitizeOption(option, revealCorrectAnswers),
  );
}

/**
 * Modifie une option existante.
 *
 * Seuls les champs fournis sont modifiés.
 * La position doit rester unique dans la question concernée.
 */
export async function updateOption(
  context: TenantContext,
  optionId: string,
  input: UpdateOptionInput,
) {
  // Récupère le tenant depuis le contexte d'authentification.
  const tenantId = ensureTenantContext(context);

  // Détermine si l'utilisateur peut voir la correction de l'option.
  const revealCorrectAnswers = await canRevealCorrectAnswers(context);

  // Recherche l'option exclusivement dans le tenant courant.
  const existingOption = await prisma.option.findFirst({
    where: {
      id: optionId,
      tenantId,
    },
  });

  // Refuse la modification si l'option n'existe pas dans ce tenant.
  if (!existingOption) {
    throw new AppError(404, "Option not found");
  }

  // Si une nouvelle position est demandée, vérifie qu'elle est disponible.
  if (input.position !== undefined) {
    const optionAtPosition = await prisma.option.findFirst({
      where: {
        tenantId,
        questionId: existingOption.questionId,
        position: input.position,
        // Exclut l'option actuelle de la recherche de conflit.
        id: {
          not: optionId,
        },
      },
      select: {
        id: true,
      },
    });

    // Empêche deux options de la même question d'avoir la même position.
    if (optionAtPosition) {
      throw new AppError(409, "An option already exists at this position");
    }
  }

  // Construit la mise à jour uniquement avec les champs réellement fournis.
  const option = await prisma.option.update({
    where: {
      id: optionId,
      tenantId,
    },
    data: {
      // Modifie le texte uniquement si le champ est présent.
      ...(input.text !== undefined && { text: input.text }),

      // Modifie la correction uniquement si une valeur a été fournie.
      ...(input.isCorrect !== undefined && {
        isCorrect: input.isCorrect,
      }),

      // Modifie la position uniquement si elle est fournie.
      ...(input.position !== undefined && {
        position: input.position,
      }),
    },
  });

  // Ne renvoie pas la correction aux utilisateurs non autorisés.
  return sanitizeOption(option, revealCorrectAnswers);
}

/**
 * Supprime une option.
 *
 * L'option est d'abord recherchée dans le tenant courant afin d'éviter
 * toute suppression d'une ressource appartenant à un autre tenant.
 */
export async function deleteOption(
  context: TenantContext,
  optionId: string,
) {
  // Vérifie la présence d'un tenant dans le contexte.
  const tenantId = ensureTenantContext(context);

  // Recherche l'option dans le périmètre du tenant courant.
  const existingOption = await prisma.option.findFirst({
    where: {
      id: optionId,
      tenantId,
    },
    select: {
      id: true,
    },
  });

  // Renvoie 404 si l'option n'existe pas dans ce tenant.
  if (!existingOption) {
    throw new AppError(404, "Option not found");
  }

  // Supprime uniquement l'option identifiée dans le tenant courant.
  await prisma.option.delete({
    where: {
      id: optionId,
      tenantId,
    },
  });
}


/**
 * Démarre une nouvelle tentative de quiz pour un apprenant.
 *
 * Le quiz, la leçon, le module, la formation et l'inscription
 * sont vérifiés dans le tenant de l'utilisateur authentifié.
 * Chaque démarrage crée une nouvelle tentative indépendante.
 */
export async function startQuizAttempt(
  context: TenantContext,
  quizId: string,
) {
  const tenantId = ensureTenantContext(context);


if (!context.roleId || context.systemRole === "SUPER_ADMIN") {
  throw new AppError(403, "Only enrolled learners can start a quiz");
}

// Vérifie que le rôle appartient au tenant courant.
const role = await prisma.role.findFirst({
  where: {
    id: context.roleId,
    tenantId,
  },
  select: {
    name: true,
  },
});

// Seuls les apprenants peuvent démarrer une tentative.
if (!role || role.name !== "APPRENANT") {
  throw new AppError(403, "Only learners can start a quiz");
}


  // Vérifie que le quiz appartient au tenant et qu'il est actif.
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      tenantId,
      isActive: true,
    },
    include: {
      lesson: {
        include: {
          module: {
            include: {
              formation: true,
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    throw new AppError(404, "Active quiz not found");
  }

  const formationId = quiz.lesson.module.formation.id;

  // Vérifie que l'utilisateur possède une inscription active.
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      tenantId,
      userId: context.userId,
      formationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  if (!enrollment) {
    throw new AppError(403, "An active enrollment is required");
  }

  // Une nouvelle tentative est créée sans modifier l'historique.
  return prisma.quizAttempt.create({
    data: {
      tenantId,
      quizId: quiz.id,
      userId: context.userId,
    },
    select: {
      id: true,
      quizId: true,
      score: true,
      percentage: true,
      passed: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
}


/**
 * Soumet les réponses d'une tentative et calcule le résultat côté serveur.
 *
 * Les réponses, le score et le statut de réussite sont vérifiés
 * exclusivement par le backend.
 */
export async function submitQuizAttempt(
  context: TenantContext,
  attemptId: string,
  input: SubmitQuizInput,
) {
  const tenantId = ensureTenantContext(context);

  // Vérifie que seul un apprenant du tenant peut soumettre ses réponses.
  if (!context.roleId || context.systemRole === "SUPER_ADMIN") {
    throw new AppError(403, "Only learners can submit a quiz");
  }

  const role = await prisma.role.findFirst({
    where: {
      id: context.roleId,
      tenantId,
    },
    select: {
      name: true,
    },
  });

  if (!role || role.name !== "APPRENANT") {
    throw new AppError(403, "Only learners can submit a quiz");
  }

  // Vérifie que la tentative appartient à l'utilisateur connecté.
  const attempt = await prisma.quizAttempt.findFirst({
    where: {
      id: attemptId,
      tenantId,
      userId: context.userId,
    },
    include: {
      quiz: {
        include: {
          lesson: {
            include: {
              module: {
                include: {
                  formation: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw new AppError(404, "Quiz attempt not found");
  }

  if (attempt.completedAt !== null) {
    throw new AppError(409, "This quiz attempt is already completed");
  }

  if (!attempt.quiz.isActive) {
    throw new AppError(409, "This quiz is no longer active");
  }

  // Vérifie que l'inscription à la formation est toujours active.
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      tenantId,
      userId: context.userId,
      formationId: attempt.quiz.lesson.module.formation.id,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  if (!enrollment) {
    throw new AppError(403, "An active enrollment is required");
  }

  // Récupère toutes les questions et leurs corrections côté serveur.
  const questions = await prisma.question.findMany({
    where: {
      tenantId,
      quizId: attempt.quizId,
    },
    include: {
      options: {
        select: {
          id: true,
          isCorrect: true,
        },
      },
    },
  });

  if (questions.length === 0) {
    throw new AppError(409, "This quiz has no questions");
  }

  const questionMap = new Map(
    questions.map((question) => [question.id, question]),
  );

  // Valide toutes les réponses avant de commencer l'enregistrement.
  for (const answer of input.answers) {
    const question = questionMap.get(answer.questionId);

    if (!question) {
      throw new AppError(
        400,
        "A submitted question does not belong to this quiz",
      );
    }

    if (
      question.type === "SINGLE_CHOICE" &&
      answer.optionIds.length > 1
    ) {
      throw new AppError(
        400,
        "A single-choice question accepts only one option",
      );
    }

    const validOptionIds = new Set(
      question.options.map((option) => option.id),
    );

    for (const optionId of answer.optionIds) {
      if (!validOptionIds.has(optionId)) {
        throw new AppError(
          400,
          "A selected option does not belong to its question",
        );
      }
    }
  }

  // Les questions absentes de la soumission restent sans réponse et valent zéro.
  let score = 0;

  const totalPoints = questions.reduce(
    (total, question) => total + question.points,
    0,
  );

  for (const answer of input.answers) {
    const question = questionMap.get(answer.questionId)!;

    const correctOptionIds = question.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id)
      .sort();

    const selectedOptionIds = [...answer.optionIds].sort();

    const isCorrect =
      correctOptionIds.length > 0 &&
      correctOptionIds.length === selectedOptionIds.length &&
      correctOptionIds.every(
        (optionId, index) => optionId === selectedOptionIds[index],
      );

    if (isCorrect) {
      score += question.points;
    }
  }

  const percentage =
    totalPoints > 0 ? (score / totalPoints) * 100 : 0;

  const passed = percentage >= attempt.quiz.passingScore;

  // Enregistre les réponses et le résultat dans une transaction.
  return prisma.$transaction(async (tx) => {
    // Verrou logique : une seule requête peut finaliser cette tentative.
    const finalized = await tx.quizAttempt.updateMany({
      where: {
        id: attemptId,
        tenantId,
        userId: context.userId,
        completedAt: null,
      },
      data: {
        score,
        percentage,
        passed,
        completedAt: new Date(),
      },
    });

    if (finalized.count !== 1) {
      throw new AppError(
        409,
        "This quiz attempt has already been submitted",
      );
    }

    const answersToCreate = input.answers.flatMap((answer) =>
      answer.optionIds.map((optionId) => ({
        tenantId,
        attemptId,
        questionId: answer.questionId,
        optionId,
      })),
    );

    if (answersToCreate.length > 0) {
      await tx.quizAnswer.createMany({
        data: answersToCreate,
      });
    }


    return tx.quizAttempt.findFirstOrThrow({
      where: {
        id: attemptId,
        tenantId,
        userId: context.userId,
      },
      select: {
        id: true,
        quizId: true,
        score: true,
        percentage: true,
        passed: true,
        startedAt: true,
        completedAt: true,
      },
    });
  });
}
