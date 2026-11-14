
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import type { AuthUser } from "../../types/auth.types.js";
import { askAI } from "./ai.service.js";
import {
  generateTrainerContentSchema,
  listTrainerDraftsSchema,
  trainerDraftIdSchema,
  updateTrainerDraftSchema,
  reviewTrainerDraftSchema,
  type GenerateTrainerContentInput,
  type ListTrainerDraftsInput,
  type UpdateTrainerDraftInput,
  type ReviewTrainerDraftInput,
} from "./ai.trainer.schema.js";

// Contexte métier utilisé par les opérations d'assistance aux formateurs.
interface AITrainerContext {
  userId: string;
  tenantId: string | null;
  roleId: string | null;
  systemRole: "SUPER_ADMIN" | null;
}

// Vérifie que l'utilisateur possède un contexte tenant valide.
function ensureTenantContext(
  context: AITrainerContext,
): asserts context is AITrainerContext & {
  tenantId: string;
  roleId: string;
} {
  if (
    context.systemRole === "SUPER_ADMIN" ||
    !context.tenantId ||
    !context.roleId
  ) {
    throw new AppError(
      403,
      "Cette fonctionnalité est réservée aux formateurs d'un établissement.",
    );
  }
}

// Vérifie le rôle réel de l'utilisateur dans la base de données.
async function ensureFormateur(
  context: AITrainerContext,
): Promise<void> {
  ensureTenantContext(context);

  const user = await prisma.user.findFirst({
    where: {
      id: context.userId,
      tenantId: context.tenantId,
      roleId: context.roleId,
      isActive: true,
      systemRole: null,
      role: {
        name: "FORMATEUR",
        tenantId: context.tenantId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new AppError(
      403,
      "Accès réservé aux formateurs actifs.",
    );
  }
}

// Vérifie que la formation appartient au formateur connecté.
async function ensureFormationOwnership(
  context: AITrainerContext,
  formationId: string,
): Promise<void> {
  ensureTenantContext(context);

  const formation = await prisma.formation.findFirst({
    where: {
      id: formationId,
      tenantId: context.tenantId,
      formateurId: context.userId,
    },
    select: {
      id: true,
    },
  });

  if (!formation) {
    throw new AppError(
      404,
      "Formation introuvable ou inaccessible.",
    );
  }
}

// Vérifie qu'une leçon appartient à la formation concernée.
async function ensureLessonOwnership(
  context: AITrainerContext,
  formationId: string,
  lessonId: string,
): Promise<void> {
  ensureTenantContext(context);

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      tenantId: context.tenantId,
      module: {
        formationId,
        formation: {
          tenantId: context.tenantId,
          formateurId: context.userId,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!lesson) {
    throw new AppError(
      404,
      "Leçon introuvable ou inaccessible dans cette formation.",
    );
  }
}

// Convertit le contexte JWT en contexte métier.
export function getAITrainerContext(
  authUser: AuthUser,
): AITrainerContext {
  return {
    userId: authUser.userId,
    tenantId: authUser.tenantId,
    roleId: authUser.roleId,
    systemRole: authUser.systemRole,
  };
}


type GeneratedQuizOption = {
  text: string;
  isCorrect: boolean;
};

type GeneratedQuizQuestion = {
  text: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  points: number;
  options: GeneratedQuizOption[];
  explanation: string;
};

type GeneratedTrainerContent =
  | {
      title: string;
      description: string;
      questions: GeneratedQuizQuestion[];
    }
  | {
      title: string;
      instructions: string;
      objectives: string[];
      correction: string;
    }
  | {
      title: string;
      introduction: string;
      objectives: string[];
      sections: Array<{
        title: string;
        content: string;
      }>;
      conclusion: string;
    };

// Construit les instructions adaptées au contenu demandé.
function buildTrainerPrompt(
  input: GenerateTrainerContentInput,
): string {
  const common = `
Tu es un assistant pédagogique professionnel intégré à EDUAI.
Tu aides les formateurs à préparer des contenus pédagogiques de qualité.

Consignes obligatoires :
- Réponds exclusivement en français.
- Respecte le niveau de difficulté demandé : ${input.difficulty}.
- Utilise des explications pédagogiques précises.
- Ne produis aucune information inventée présentée comme un fait certain.
- Retourne uniquement un objet JSON valide.
- N'utilise aucun bloc Markdown ni balise de code.
`;

  if (input.type === "QUIZ") {
    return `${common}

Génère un quiz contenant exactement ${input.questionCount ?? 5} questions.

Format JSON attendu :
{
  "title": "Titre du quiz",
  "description": "Description du quiz",
  "questions": [
    {
      "text": "Question",
      "type": "SINGLE_CHOICE",
      "points": 1,
      "options": [
        { "text": "Réponse A", "isCorrect": true },
        { "text": "Réponse B", "isCorrect": false },
        { "text": "Réponse C", "isCorrect": false },
        { "text": "Réponse D", "isCorrect": false }
      ],
      "explanation": "Explication pédagogique"
    }
  ]
}

Règles :
- Chaque question doit avoir entre 2 et 4 propositions.
- SINGLE_CHOICE doit avoir exactement une réponse correcte.
- MULTIPLE_CHOICE doit avoir au moins deux réponses correctes.
- TRUE_FALSE doit avoir exactement deux propositions et une réponse correcte.
- Les points doivent être des nombres positifs.
- Les explications doivent justifier la réponse correcte.

Consignes du formateur :
${input.instructions}`;
  }

  if (input.type === "EXERCISE") {
    return `${common}

Prépare un exercice pédagogique.

Format JSON attendu :
{
  "title": "Titre de l'exercice",
  "instructions": "Énoncé et consignes détaillés",
  "objectives": ["Objectif 1", "Objectif 2"],
  "correction": "Correction détaillée proposée"
}

Consignes du formateur :
${input.instructions}`;
  }

  return `${common}

Prépare un contenu pédagogique structuré pour une leçon.

Format JSON attendu :
{
  "title": "Titre de la leçon",
  "introduction": "Introduction",
  "objectives": ["Objectif 1", "Objectif 2"],
  "sections": [
    {
      "title": "Titre de la section",
      "content": "Développement pédagogique"
    }
  ],
  "conclusion": "Conclusion"
}

Consignes du formateur :
${input.instructions}`;
}

// Vérifie les structures générées avant leur enregistrement.
function validateGeneratedContent(
  type: GenerateTrainerContentInput["type"],
  value: unknown,
): GeneratedTrainerContent {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new AppError(502, "La réponse IA doit être un objet JSON.");
  }

  const data = value as Record<string, unknown>;

  const requiredString = (field: string): boolean =>
    typeof data[field] === "string" &&
    data[field].trim().length > 0;

  if (!requiredString("title")) {
    throw new AppError(502, "Le contenu généré ne possède pas de titre valide.");
  }

  if (type === "QUIZ") {
    if (
      !requiredString("description") ||
      !Array.isArray(data.questions) ||
      data.questions.length === 0
    ) {
      throw new AppError(502, "Structure du quiz généré invalide.");
    }

    const questions = data.questions.map((item) => {
      if (
        typeof item !== "object" ||
        item === null ||
        Array.isArray(item)
      ) {
        throw new AppError(502, "Question générée invalide.");
      }

      const question = item as Record<string, unknown>;

      if (
        typeof question.text !== "string" ||
        !question.text.trim() ||
        !["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(
          String(question.type),
        ) ||
        typeof question.points !== "number" ||
        !Number.isFinite(question.points) ||
        question.points <= 0 ||
        typeof question.explanation !== "string" ||
        !question.explanation.trim() ||
        !Array.isArray(question.options)
      ) {
        throw new AppError(502, "Structure d'une question invalide.");
      }

      const options = question.options.map((option) => {
        if (
          typeof option !== "object" ||
          option === null ||
          Array.isArray(option)
        ) {
          throw new AppError(502, "Proposition de réponse invalide.");
        }

        const parsed = option as Record<string, unknown>;

        if (
          typeof parsed.text !== "string" ||
          !parsed.text.trim() ||
          typeof parsed.isCorrect !== "boolean"
        ) {
          throw new AppError(502, "Proposition de réponse invalide.");
        }

        return {
          text: parsed.text.trim(),
          isCorrect: parsed.isCorrect,
        };
      });

      const correctCount = options.filter(
        (option) => option.isCorrect,
      ).length;

      const questionType = question.type as GeneratedQuizQuestion["type"];

      if (options.length < 2 || options.length > 4) {
        throw new AppError(502, "Une question doit avoir entre 2 et 4 propositions.");
      }

      if (
        questionType === "SINGLE_CHOICE" &&
        correctCount !== 1
      ) {
        throw new AppError(502, "Une question à choix unique doit avoir une seule bonne réponse.");
      }

      if (
        questionType === "MULTIPLE_CHOICE" &&
        correctCount < 2
      ) {
        throw new AppError(502, "Une question à choix multiple doit avoir au moins deux bonnes réponses.");
      }

      if (
        questionType === "TRUE_FALSE" &&
        (options.length !== 2 || correctCount !== 1)
      ) {
        throw new AppError(502, "Une question vrai/faux doit avoir deux propositions et une seule bonne réponse.");
      }

      return {
        text: question.text.trim(),
        type: questionType,
        points: question.points,
        options,
        explanation: question.explanation.trim(),
      };
    });

    return {
      title: String(data.title).trim(),
      description: String(data.description).trim(),
      questions,
    };
  }

  if (type === "EXERCISE") {
    if (
      !requiredString("instructions") ||
      !requiredString("correction") ||
      !Array.isArray(data.objectives) ||
      data.objectives.length === 0 ||
      !data.objectives.every(
        (objective) =>
          typeof objective === "string" && objective.trim().length > 0,
      )
    ) {
      throw new AppError(502, "Structure de l'exercice généré invalide.");
    }

    return {
      title: String(data.title).trim(),
      instructions: String(data.instructions).trim(),
      objectives: (data.objectives as string[]).map((item) => item.trim()),
      correction: String(data.correction).trim(),
    };
  }

  if (
    !requiredString("introduction") ||
    !requiredString("conclusion") ||
    !Array.isArray(data.objectives) ||
    data.objectives.length === 0 ||
    !Array.isArray(data.sections) ||
    data.sections.length === 0
  ) {
    throw new AppError(502, "Structure du contenu pédagogique invalide.");
  }

  const sections = data.sections.map((section) => {
    if (
      typeof section !== "object" ||
      section === null ||
      Array.isArray(section)
    ) {
      throw new AppError(502, "Section pédagogique invalide.");
    }

    const parsed = section as Record<string, unknown>;

    if (
      typeof parsed.title !== "string" ||
      !parsed.title.trim() ||
      typeof parsed.content !== "string" ||
      !parsed.content.trim()
    ) {
      throw new AppError(502, "Section pédagogique incomplète.");
    }

    return {
      title: parsed.title.trim(),
      content: parsed.content.trim(),
    };
  });

  if (
    !data.objectives.every(
      (objective) =>
        typeof objective === "string" && objective.trim().length > 0,
    )
  ) {
    throw new AppError(502, "Objectifs pédagogiques invalides.");
  }

  return {
    title: String(data.title).trim(),
    introduction: String(data.introduction).trim(),
    objectives: (data.objectives as string[]).map((item) => item.trim()),
    sections,
    conclusion: String(data.conclusion).trim(),
  };
}

// Génère et enregistre un brouillon pédagogique en attente de validation.
export async function generateTrainerContent(
  context: AITrainerContext,
  rawInput: unknown,
) {
  await ensureFormateur(context);

  const input = generateTrainerContentSchema.parse(rawInput);

  await ensureFormationOwnership(context, input.formationId);

  if (input.lessonId) {
    await ensureLessonOwnership(
      context,
      input.formationId,
      input.lessonId,
    );
  }

  if (input.type !== "QUIZ" && input.questionCount !== undefined) {
    throw new AppError(
      400,
      "Le nombre de questions est uniquement applicable à la génération de quiz.",
    );
  }

  const response = await askAI(
    [
      {
        role: "user",
        content: buildTrainerPrompt(input),
      },
    ],
    "Tu es un moteur de génération de contenus pédagogiques structurés. Respecte strictement le format JSON demandé.",
  );

  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(response.content);
  } catch {
    throw new AppError(
      502,
      "Le fournisseur IA a retourné un contenu JSON invalide.",
    );
  }

  const content = validateGeneratedContent(
    input.type,
    parsedContent,
  );

  return prisma.aITrainerDraft.create({
    data: {
      tenantId: context.tenantId!,
      formateurId: context.userId,
      formationId: input.formationId,
      lessonId: input.lessonId ?? null,
      type: input.type,
      content: JSON.parse(JSON.stringify(content)),
      status: "PENDING",
    },
    select: {
      id: true,
      formationId: true,
      lessonId: true,
      type: true,
      content: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function listTrainerDrafts(
  context: AITrainerContext,
  rawFilters: ListTrainerDraftsInput,
) {
  await ensureFormateur(context);

  const filters = listTrainerDraftsSchema.parse(rawFilters);

  ensureTenantContext(context);

  if (filters.formationId) {
    await ensureFormationOwnership(context, filters.formationId);
  }

  return prisma.aITrainerDraft.findMany({
    where: {
      tenantId: context.tenantId!,
      formateurId: context.userId,
      ...(filters.formationId && {
        formationId: filters.formationId,
      }),
      ...(filters.type && {
        type: filters.type,
      }),
      ...(filters.status && {
        status: filters.status,
      }),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    select: {
      id: true,
      formationId: true,
      lessonId: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getTrainerDraftById(
  context: AITrainerContext,
  rawDraftId: unknown,
) {
  await ensureFormateur(context);
  ensureTenantContext(context);

  const { draftId } = trainerDraftIdSchema.parse({
    draftId: rawDraftId,
  });

  const draft = await prisma.aITrainerDraft.findFirst({
    where: {
      id: draftId,
      tenantId: context.tenantId!,
      formateurId: context.userId,
    },
    select: {
      id: true,
      formationId: true,
      lessonId: true,
      type: true,
      content: true,
      status: true,
      reviewedAt: true,
      reviewedById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!draft) {
    throw new AppError(404, "Brouillon introuvable ou inaccessible.");
  }

  return draft;
}

export async function updateTrainerDraft(
  context: AITrainerContext,
  rawDraftId: unknown,
  rawInput: UpdateTrainerDraftInput,
) {
  await ensureFormateur(context);
  ensureTenantContext(context);

  const { draftId } = trainerDraftIdSchema.parse({
    draftId: rawDraftId,
  });

  const input = updateTrainerDraftSchema.parse(rawInput);

  const existingDraft = await prisma.aITrainerDraft.findFirst({
    where: {
      id: draftId,
      tenantId: context.tenantId!,
      formateurId: context.userId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existingDraft) {
    throw new AppError(404, "Brouillon introuvable ou inaccessible.");
  }

  if (existingDraft.status !== "PENDING") {
    throw new AppError(
      409,
      "Seuls les brouillons en attente peuvent être modifiés.",
    );
  }

  const result = await prisma.aITrainerDraft.updateMany({
    where: {
      id: draftId,
      tenantId: context.tenantId!,
      formateurId: context.userId,
      status: "PENDING",
    },
    data: {
      content: JSON.parse(JSON.stringify(input.content)),
    },
  });

  if (result.count === 0) {
    throw new AppError(
      409,
      "Le brouillon a changé de statut et ne peut plus être modifié.",
    );
  }

  return prisma.aITrainerDraft.findFirst({
    where: {
      id: draftId,
      tenantId: context.tenantId!,
      formateurId: context.userId,
    },
    select: {
      id: true,
      formationId: true,
      lessonId: true,
      type: true,
      content: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function reviewTrainerDraft(
  context: AITrainerContext,
  rawDraftId: unknown,
  rawInput: ReviewTrainerDraftInput,
) {
  await ensureFormateur(context);
  ensureTenantContext(context);

  const { draftId } = trainerDraftIdSchema.parse({
    draftId: rawDraftId,
  });

  const input = reviewTrainerDraftSchema.parse(rawInput);

  const result = await prisma.aITrainerDraft.updateMany({
    where: {
      id: draftId,
      tenantId: context.tenantId!,
      formateurId: context.userId,
      status: "PENDING",
    },
    data: {
      status: input.status,
      reviewedAt: new Date(),
      reviewedById: context.userId,
    },
  });

  if (result.count === 0) {
    const existingDraft = await prisma.aITrainerDraft.findFirst({
      where: {
        id: draftId,
        tenantId: context.tenantId!,
        formateurId: context.userId,
      },
      select: {
        id: true,
      },
    });

    if (!existingDraft) {
      throw new AppError(404, "Brouillon introuvable ou inaccessible.");
    }

    throw new AppError(
      409,
      "Ce brouillon a déjà été traité et ne peut plus être révisé.",
    );
  }

  return prisma.aITrainerDraft.findFirst({
    where: {
      id: draftId,
      tenantId: context.tenantId!,
      formateurId: context.userId,
    },
    select: {
      id: true,
      formationId: true,
      lessonId: true,
      type: true,
      status: true,
      reviewedAt: true,
      reviewedById: true,
      updatedAt: true,
    },
  });
}