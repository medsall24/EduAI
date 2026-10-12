import { z } from "zod";

/**
 * Validation des données nécessaires à la création d'un Quiz.
 *
 * Le quiz est rattaché à une Lesson.
 * Le tenantId n'est volontairement pas accepté ici :
 * il doit provenir du contexte d'authentification JWT
 * afin d'empêcher un utilisateur de manipuler le tenant.
 */
export const createQuizSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must contain at least 3 characters")
    .max(255, "Title must not exceed 255 characters"),

  description: z
    .string()
    .trim()
    .max(5000, "Description must not exceed 5000 characters")
    .optional(),

  /**
   * Durée maximale du quiz en minutes.
   * La valeur est optionnelle : un quiz peut être sans limite de durée.
   */
  duration: z
    .number()
    .int("Duration must be an integer")
    .positive("Duration must be greater than 0")
    .optional(),

  /**
   * Score minimal requis pour réussir le quiz.
   * Valeur exprimée en pourcentage, entre 0 et 100.
   */
  passingScore: z
    .number()
    .min(0, "Passing score must be at least 0")
    .max(100, "Passing score must not exceed 100")
    .optional(),

  /**
   * Permet d'activer ou désactiver le quiz.
   * Par défaut, Prisma utilise true.
   */
  isActive: z.boolean().optional(),
});

/**
 * Validation des données autorisées lors de la modification d'un Quiz.
 *
 * Tous les champs sont optionnels car une mise à jour peut
 * ne concerner qu'une seule propriété.
 */
export const updateQuizSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must contain at least 3 characters")
      .max(255, "Title must not exceed 255 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .max(5000, "Description must not exceed 5000 characters")
      .nullable()
      .optional(),

    duration: z
      .number()
      .int("Duration must be an integer")
      .positive("Duration must be greater than 0")
      .nullable()
      .optional(),

    passingScore: z
      .number()
      .min(0, "Passing score must be at least 0")
      .max(100, "Passing score must not exceed 100")
      .optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Validation de l'identifiant d'une Lesson.
 *
 * Utilisée notamment pour les routes :
 * POST /api/lessons/:lessonId/quizzes
 */
export const lessonIdSchema = z.object({
  lessonId: z.string().uuid("Invalid lesson ID"),
});

/**
 * Validation de l'identifiant d'un Quiz.
 *
 * Utilisée pour les routes ciblant directement un quiz.
 */
export const quizIdSchema = z.object({
  quizId: z.string().uuid("Invalid quiz ID"),
});


/**
 * Validation de l'identifiant d'une tentative de quiz.
 */
export const attemptIdSchema = z.object({
  attemptId: z.string().uuid("Invalid attempt ID"),
});


/**
 * Type TypeScript correspondant aux données de création d'un Quiz.
 */
export type CreateQuizInput = z.infer<typeof createQuizSchema>;

/**
 * Type TypeScript correspondant aux données de modification d'un Quiz.
 */
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;

/**
 * Types de questions autorisés dans un Quiz.
 */
export const questionTypeSchema = z.enum([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
]);

/**
 * Validation des données nécessaires à la création d'une Question.
 *
 * Le tenantId n'est volontairement pas accepté :
 * il provient exclusivement du contexte JWT.
 */
export const createQuestionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(3, "Question text must contain at least 3 characters")
    .max(5000, "Question text must not exceed 5000 characters"),

  type: questionTypeSchema,

  points: z
    .number()
    .positive("Points must be greater than 0")
    .optional(),

  position: z
    .number()
    .int("Position must be an integer")
    .positive("Position must be greater than 0"),
});

/**
 * Validation des données autorisées lors de la modification
 * d'une Question.
 */
export const updateQuestionSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(3, "Question text must contain at least 3 characters")
      .max(5000, "Question text must not exceed 5000 characters")
      .optional(),

    type: questionTypeSchema.optional(),

    points: z
      .number()
      .positive("Points must be greater than 0")
      .optional(),

    position: z
      .number()
      .int("Position must be an integer")
      .positive("Position must be greater than 0")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Validation de l'identifiant d'une Question.
 */
export const questionIdSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),
});

/**
 * Types TypeScript correspondant aux données Question.
 */
export type CreateQuestionInput = z.infer<
  typeof createQuestionSchema
>;

export type UpdateQuestionInput = z.infer<
  typeof updateQuestionSchema
>;


/**
 * Validation des données nécessaires à la création d'une option.
 *
 * Le tenantId provient exclusivement du contexte JWT.
 */
export const createOptionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Option text must contain at least 1 character")
    .max(2000, "Option text must not exceed 2000 characters"),

  isCorrect: z.boolean().optional(),

  position: z
    .number()
    .int("Position must be an integer")
    .positive("Position must be greater than 0"),
});

/**
 * Validation des données autorisées lors de la modification
 * d'une option.
 */
export const updateOptionSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Option text must contain at least 1 character")
      .max(2000, "Option text must not exceed 2000 characters")
      .optional(),

    isCorrect: z.boolean().optional(),

    position: z
      .number()
      .int("Position must be an integer")
      .positive("Position must be greater than 0")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Validation de l'identifiant d'une option.
 */
export const optionIdSchema = z.object({
  optionId: z.string().uuid("Invalid option ID"),
});

/**
 * Types TypeScript correspondant aux données des options.
 */
export type CreateOptionInput = z.infer<
  typeof createOptionSchema
>;

export type UpdateOptionInput = z.infer<
  typeof updateOptionSchema
>;



/**
 * Validation d'une réponse soumise par un apprenant.
 *
 * Un tableau vide signifie que l'apprenant a laissé
 * cette question sans réponse : elle vaudra 0 point.
 */
export const submitAnswerSchema = z.object({
  questionId: z.string().uuid("Invalid question ID"),

  optionIds: z
    .array(z.string().uuid("Invalid option ID"))
    .max(100, "Too many options selected")
    .refine(
      (optionIds) => new Set(optionIds).size === optionIds.length,
      "Duplicate option IDs are not allowed",
    ),
});


/**
 * Validation du corps de la soumission d'un quiz.
 *
 * Le score et le statut de réussite ne sont pas acceptés :
 * ils seront calculés exclusivement par le serveur.
 */
export const submitQuizSchema = z.object({
  answers: z
    .array(submitAnswerSchema)
    .min(1, "At least one answer is required")
    .max(500, "Too many answers submitted")
    .refine(
      (answers) =>
        new Set(answers.map((answer) => answer.questionId)).size ===
        answers.length,
      "Duplicate question answers are not allowed",
    ),
});

/**
 * Type TypeScript des réponses soumises.
 */
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;