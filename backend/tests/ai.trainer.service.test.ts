
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  userFindFirst,
  formationFindFirst,
  lessonFindFirst,
  draftCreate,
  draftFindMany,
  draftFindFirst,
  draftUpdateMany,
  askAIMock,
} = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  formationFindFirst: vi.fn(),
  lessonFindFirst: vi.fn(),
  draftCreate: vi.fn(),
  draftFindMany: vi.fn(),
  draftFindFirst: vi.fn(),
  draftUpdateMany: vi.fn(),
  askAIMock: vi.fn(),
}));

vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: userFindFirst,
    },
    formation: {
      findFirst: formationFindFirst,
    },
    lesson: {
      findFirst: lessonFindFirst,
    },
    aITrainerDraft: {
      create: draftCreate,
      findMany: draftFindMany,
      findFirst: draftFindFirst,
      updateMany: draftUpdateMany,
    },
  },
}));

vi.mock("../src/modules/ai/ai.service.js", () => ({
  askAI: askAIMock,
}));

import {
  generateTrainerContent,
  listTrainerDrafts,
  getTrainerDraftById,
  updateTrainerDraft,
  reviewTrainerDraft,
} from "../src/modules/ai/ai.trainer.service.js";

const context = {
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "11111111-1111-4111-8111-111111111111",
  roleId: "22222222-2222-4222-8222-222222222222",
  systemRole: null,
};

const formationId = "44444444-4444-4444-8444-444444444444";
const lessonId = "55555555-5555-4555-8555-555555555555";
const draftId = "66666666-6666-4666-8666-666666666666";

describe("AI trainer service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    userFindFirst.mockResolvedValue({ id: context.userId });
    formationFindFirst.mockResolvedValue({ id: formationId });
    lessonFindFirst.mockResolvedValue({ id: lessonId });

    draftCreate.mockResolvedValue({
      id: draftId,
      formationId,
      lessonId: null,
      type: "QUIZ",
      content: {},
      status: "PENDING",
      createdAt: new Date(),
    });

    draftFindMany.mockResolvedValue([]);
    draftFindFirst.mockResolvedValue(null);
    draftUpdateMany.mockResolvedValue({ count: 1 });

    askAIMock.mockResolvedValue({
        success: true,
        provider: "gemini",
        model: "test-model",
        inputTokens: 100,
        outputTokens: 200,
        content: JSON.stringify({
        title: "Quiz de programmation",
        description: "Évaluation des connaissances",
        questions: [
          {
            text: "Que signifie HTML ?",
            type: "SINGLE_CHOICE",
            points: 1,
            options: [
              { text: "HyperText Markup Language", isCorrect: true },
              { text: "HighText Machine Language", isCorrect: false },
            ],
            explanation: "HTML signifie HyperText Markup Language.",
          },
        ],
      }),
    });
  });

  describe("Contrôles d'accès", () => {
    it("refuse l'accès sans contexte tenant", async () => {
      await expect(
        listTrainerDrafts({
          ...context,
          tenantId: null,
        }, {}),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      expect(userFindFirst).not.toHaveBeenCalled();
      expect(draftFindMany).not.toHaveBeenCalled();
    });

    it("refuse l'accès à SUPER_ADMIN", async () => {
      await expect(
        listTrainerDrafts({
          ...context,
          systemRole: "SUPER_ADMIN",
        }, {}),
      ).rejects.toMatchObject({
        statusCode: 403,
      });

      expect(userFindFirst).not.toHaveBeenCalled();
    });

    it("refuse l'accès à un utilisateur qui n'est pas formateur actif", async () => {
      userFindFirst.mockResolvedValueOnce(null);

      await expect(
        listTrainerDrafts(context, {}),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Accès réservé aux formateurs actifs.",
      });

      expect(draftFindMany).not.toHaveBeenCalled();
    });

    it("vérifie le tenant, le rôle et le statut actif dans la requête utilisateur", async () => {
      await listTrainerDrafts(context, {});

      expect(userFindFirst).toHaveBeenCalledWith({
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
    });
  });

  describe("Propriété des formations", () => {
    it("refuse la génération pour une formation inaccessible", async () => {
      formationFindFirst.mockResolvedValueOnce(null);

      await expect(
        generateTrainerContent(context, {
          formationId,
          type: "QUIZ",
          instructions: "Créer un quiz sur JavaScript.",
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Formation introuvable ou inaccessible.",
      });

      expect(askAIMock).not.toHaveBeenCalled();
      expect(draftCreate).not.toHaveBeenCalled();
    });
  });
  describe("Génération des contenus pédagogiques", () => {
  it("génère un quiz et l'enregistre comme brouillon PENDING", async () => {
    const result = await generateTrainerContent(context, {
      formationId,
      type: "QUIZ",
      instructions: "Créer un quiz sur JavaScript.",
      questionCount: 1,
    });

    expect(askAIMock).toHaveBeenCalledOnce();

    expect(draftCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: context.tenantId,
          formateurId: context.userId,
          formationId,
          type: "QUIZ",
          status: "PENDING",
        }),
      }),
    );

    expect(result.status).toBe("PENDING");
    expect(result.type).toBe("QUIZ");
  });

    it("refuse un quiz contenant moins de questions que demandé", async () => {
    await expect(
      generateTrainerContent(context, {
        formationId,
        type: "QUIZ",
        instructions: "Créer un quiz sur JavaScript.",
        questionCount: 2,
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
    });

    expect(draftCreate).not.toHaveBeenCalled();
  });

  it("refuse un quiz contenant plus de questions que demandé", async () => {
    const twoQuestions = {
      title: "Quiz JavaScript",
      description: "Évaluation JavaScript",
      questions: [
        {
          text: "Question 1 ?",
          type: "SINGLE_CHOICE",
          points: 1,
          explanation: "Explication 1.",
          options: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        },
        {
          text: "Question 2 ?",
          type: "SINGLE_CHOICE",
          points: 1,
          explanation: "Explication 2.",
          options: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        },
      ],
    };

    askAIMock.mockResolvedValueOnce({
      success: true,
      provider: "gemini",
      model: "test-model",
      inputTokens: 10,
      outputTokens: 10,
      content: JSON.stringify(twoQuestions),
    });

    await expect(
      generateTrainerContent(context, {
        formationId,
        type: "QUIZ",
        instructions: "Créer un quiz sur JavaScript.",
        questionCount: 1,
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
    });

    expect(draftCreate).not.toHaveBeenCalled();
  });

  it("refuse un JSON invalide retourné par le fournisseur IA", async () => {
    askAIMock.mockResolvedValueOnce({
      success: true,
      provider: "gemini",
      model: "test-model",
      inputTokens: 10,
      outputTokens: 10,
      content: "Réponse non JSON",
    });

    await expect(
      generateTrainerContent(context, {
        formationId,
        type: "QUIZ",
        instructions: "Créer un quiz sur JavaScript.",
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "Le fournisseur IA a retourné un contenu JSON invalide.",
    });

    expect(draftCreate).not.toHaveBeenCalled();
  });

  it("refuse un quiz sans réponse correcte", async () => {
    askAIMock.mockResolvedValueOnce({
      success: true,
      provider: "gemini",
      model: "test-model",
      inputTokens: 10,
      outputTokens: 10,
      content: JSON.stringify({
        title: "Quiz",
        description: "Test",
        questions: [
          {
            text: "Question ?",
            type: "SINGLE_CHOICE",
            points: 1,
            options: [
              { text: "A", isCorrect: false },
              { text: "B", isCorrect: false },
            ],
            explanation: "Explication",
          },
        ],
      }),
    });

    await expect(
      generateTrainerContent(context, {
        formationId,
        type: "QUIZ",
        instructions: "Créer un quiz sur JavaScript.",
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
    });

    expect(draftCreate).not.toHaveBeenCalled();
  });

  it("refuse questionCount pour un exercice", async () => {
    await expect(
      generateTrainerContent(context, {
        formationId,
        type: "EXERCISE",
        instructions: "Créer un exercice sur JavaScript.",
        questionCount: 5,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(askAIMock).not.toHaveBeenCalled();
    expect(draftCreate).not.toHaveBeenCalled();
  });

  it("vérifie la propriété de la leçon avant la génération", async () => {
    lessonFindFirst.mockResolvedValueOnce(null);

    await expect(
      generateTrainerContent(context, {
        formationId,
        lessonId,
        type: "QUIZ",
        instructions: "Créer un quiz sur JavaScript.",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Leçon introuvable ou inaccessible dans cette formation.",
    });

    expect(askAIMock).not.toHaveBeenCalled();
    expect(draftCreate).not.toHaveBeenCalled();
  });
});

it("génère un exercice avec ses objectifs et sa correction", async () => {
  askAIMock.mockResolvedValueOnce({
    success: true,
    provider: "gemini",
    model: "test-model",
    inputTokens: 100,
    outputTokens: 200,
    content: JSON.stringify({
      title: "Exercice JavaScript",
      instructions: "Créer une fonction qui additionne deux nombres.",
      objectives: ["Comprendre les fonctions"],
      correction: "Utiliser l'opérateur +.",
    }),
  });

  draftCreate.mockResolvedValueOnce({
  id: draftId,
  formationId,
  lessonId: null,
  type: "EXERCISE",
  content: {},
  status: "PENDING",
  createdAt: new Date(),
});
  const result = await generateTrainerContent(context, {
    formationId,
    type: "EXERCISE",
    instructions: "Préparer un exercice sur les fonctions.",
  });

  expect(result.type).toBe("EXERCISE");
  expect(result.status).toBe("PENDING");
  expect(draftCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        type: "EXERCISE",
        status: "PENDING",
      }),
    }),
  );
});

it("génère un contenu de leçon structuré", async () => {
  askAIMock.mockResolvedValueOnce({
    success: true,
    provider: "gemini",
    model: "test-model",
    inputTokens: 100,
    outputTokens: 200,
    content: JSON.stringify({
      title: "Introduction à JavaScript",
      introduction: "Présentation du langage.",
      objectives: ["Comprendre JavaScript"],
      sections: [
        {
          title: "Les bases",
          content: "Présentation des variables.",
        },
      ],
      conclusion: "Résumé de la leçon.",
    }),
  });

  draftCreate.mockResolvedValueOnce({
  id: draftId,
  formationId,
  lessonId: null,
  type: "LESSON_CONTENT",
  content: {},
  status: "PENDING",
  createdAt: new Date(),
});
  const result = await generateTrainerContent(context, {
    formationId,
    type: "LESSON_CONTENT",
    instructions: "Préparer une introduction à JavaScript.",
  });

  expect(result.type).toBe("LESSON_CONTENT");
  expect(result.status).toBe("PENDING");
});

describe("Consultation des brouillons", () => {
  it("liste les brouillons du formateur avec les filtres par défaut", async () => {
    const drafts = [
      {
        id: draftId,
        formationId,
        lessonId: null,
        type: "QUIZ",
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    draftFindMany.mockResolvedValueOnce(drafts);

    const result = await listTrainerDrafts(context, {});

    expect(result).toEqual(drafts);
    expect(draftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: context.tenantId,
          formateurId: context.userId,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });

  it("applique les filtres de formation, de type et de statut", async () => {
    draftFindMany.mockResolvedValueOnce([]);

    await listTrainerDrafts(context, {
      formationId,
      type: "QUIZ",
      status: "PENDING",
    });

    expect(formationFindFirst).toHaveBeenCalled();

    expect(draftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: context.tenantId,
          formateurId: context.userId,
          formationId,
          type: "QUIZ",
          status: "PENDING",
        },
      }),
    );
  });
});

describe("Consultation individuelle", () => {
  it("permet au formateur de consulter son propre brouillon", async () => {
    const draft = {
      id: draftId,
      formationId,
      lessonId: null,
      type: "QUIZ",
      content: { title: "Quiz JavaScript" },
      status: "PENDING",
      reviewedAt: null,
      reviewedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    draftFindFirst.mockResolvedValueOnce(draft);

    const result = await getTrainerDraftById(context, draftId);

    expect(result).toEqual(draft);
    expect(draftFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: draftId,
          tenantId: context.tenantId,
          formateurId: context.userId,
        },
      }),
    );
  });

  it("refuse la consultation d'un brouillon inaccessible", async () => {
    draftFindFirst.mockResolvedValueOnce(null);

    await expect(
      getTrainerDraftById(context, draftId),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Brouillon introuvable ou inaccessible.",
    });
  });
});

describe("Modification des brouillons", () => {
  it("permet de modifier un brouillon QUIZ PENDING avec un contenu valide", async () => {
  const validQuiz = {
    title: "Quiz JavaScript modifié",
    description: "Évaluation des connaissances JavaScript",
    questions: [
      {
        text: "Que signifie JavaScript ?",
        type: "SINGLE_CHOICE",
        points: 2,
        explanation: "JavaScript est un langage de programmation.",
        options: [
          { text: "Un langage de programmation", isCorrect: true },
          { text: "Un système d'exploitation", isCorrect: false },
        ],
      },
    ],
  };

  const updatedDraft = {
    id: draftId,
    formationId,
    lessonId: null,
    type: "QUIZ",
    content: validQuiz,
    status: "PENDING",
    updatedAt: new Date(),
  };

  draftFindFirst
    .mockResolvedValueOnce({
      id: draftId,
      status: "PENDING",
      type: "QUIZ",
    })
    .mockResolvedValueOnce(updatedDraft);

  draftUpdateMany.mockResolvedValueOnce({ count: 1 });

  const result = await updateTrainerDraft(context, draftId, {
    content: validQuiz,
  });

  expect(draftUpdateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: draftId,
        tenantId: context.tenantId,
        formateurId: context.userId,
        status: "PENDING",
      },
    }),
  );

  expect(result).toEqual(updatedDraft);
});

  it("refuse de modifier un brouillon déjà approuvé", async () => {
    draftFindFirst.mockResolvedValueOnce({
      id: draftId,
      status: "APPROVED",
    });

    await expect(
      updateTrainerDraft(context, draftId, {
        content: { title: "Modification interdite" },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(draftUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse de modifier un brouillon inaccessible", async () => {
    draftFindFirst.mockResolvedValueOnce(null);

    await expect(
      updateTrainerDraft(context, draftId, {
        content: { title: "Modification interdite" },
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(draftUpdateMany).not.toHaveBeenCalled();
  });

  it("gère un conflit si le brouillon change de statut pendant la modification", async () => {
  const validQuiz = {
    title: "Quiz JavaScript",
    description: "Évaluation JavaScript",
    questions: [
      {
        text: "Que signifie JavaScript ?",
        type: "SINGLE_CHOICE",
        points: 2,
        explanation: "JavaScript est un langage de programmation.",
        options: [
          { text: "Un langage de programmation", isCorrect: true },
          { text: "Un système d'exploitation", isCorrect: false },
        ],
      },
    ],
  };

  draftFindFirst.mockResolvedValueOnce({
    id: draftId,
    status: "PENDING",
    type: "QUIZ",
  });

  draftUpdateMany.mockResolvedValueOnce({ count: 0 });

  await expect(
    updateTrainerDraft(context, draftId, {
      content: validQuiz,
    }),
  ).rejects.toMatchObject({
    statusCode: 409,
    message: "Le brouillon a changé de statut et ne peut plus être modifié.",
  });
});
});

describe("Validation des brouillons", () => {
  it("permet d'approuver un brouillon PENDING", async () => {
    const reviewedDraft = {
      id: draftId,
      formationId,
      lessonId: null,
      type: "QUIZ",
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedById: context.userId,
      updatedAt: new Date(),
    };

    draftFindFirst.mockResolvedValueOnce(reviewedDraft);
    draftUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await reviewTrainerDraft(context, draftId, {
      status: "APPROVED",
    });

    expect(draftUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: draftId,
          tenantId: context.tenantId,
          formateurId: context.userId,
          status: "PENDING",
        },
        data: expect.objectContaining({
          status: "APPROVED",
          reviewedById: context.userId,
        }),
      }),
    );

    expect(result).toEqual(reviewedDraft);
  });

  it("permet de rejeter un brouillon PENDING", async () => {
    const reviewedDraft = {
      id: draftId,
      formationId,
      lessonId: null,
      type: "QUIZ",
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: context.userId,
      updatedAt: new Date(),
    };

    draftFindFirst.mockResolvedValueOnce(reviewedDraft);
    draftUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await reviewTrainerDraft(context, draftId, {
      status: "REJECTED",
    });

    if (result === null) {
  throw new Error("Le brouillon rejeté devrait être retourné.");
}

expect(result.status).toBe("REJECTED");
expect(result.reviewedById).toBe(context.userId);
  });

  it("refuse de traiter un brouillon inaccessible", async () => {
    draftUpdateMany.mockResolvedValueOnce({ count: 0 });
    draftFindFirst.mockResolvedValueOnce(null);

    await expect(
      reviewTrainerDraft(context, draftId, {
        status: "APPROVED",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("refuse de traiter un brouillon déjà traité", async () => {
    draftUpdateMany.mockResolvedValueOnce({ count: 0 });
    draftFindFirst.mockResolvedValueOnce({
      id: draftId,
    });

    await expect(
      reviewTrainerDraft(context, draftId, {
        status: "APPROVED",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

it("refuse une section pédagogique invalide", async () => {
  askAIMock.mockResolvedValueOnce({
    success: true,
    provider: "gemini",
    model: "test-model",
    inputTokens: 100,
    outputTokens: 200,
    content: JSON.stringify({
      title: "Introduction à JavaScript",
      introduction: "Présentation du langage.",
      objectives: ["Comprendre JavaScript"],
      sections: [null],
      conclusion: "Résumé de la leçon.",
    }),
  });

  await expect(
    generateTrainerContent(context, {
      formationId,
      type: "LESSON_CONTENT",
      instructions: "Préparer une introduction à JavaScript.",
    }),
  ).rejects.toMatchObject({
    statusCode: 502,
    message: "Section pédagogique invalide.",
  });

  expect(draftCreate).not.toHaveBeenCalled();
});
it("refuse une section pédagogique incomplète", async () => {
  askAIMock.mockResolvedValueOnce({
    success: true,
    provider: "gemini",
    model: "test-model",
    inputTokens: 100,
    outputTokens: 200,
    content: JSON.stringify({
      title: "Introduction à JavaScript",
      introduction: "Présentation du langage.",
      objectives: ["Comprendre JavaScript"],
      sections: [
        {
          title: "",
          content: "Présentation des variables.",
        },
      ],
      conclusion: "Résumé de la leçon.",
    }),
  });

  await expect(
    generateTrainerContent(context, {
      formationId,
      type: "LESSON_CONTENT",
      instructions: "Préparer une introduction à JavaScript.",
    }),
  ).rejects.toMatchObject({
    statusCode: 502,
    message: "Section pédagogique incomplète.",
  });

  expect(draftCreate).not.toHaveBeenCalled();
});

it("refuse des objectifs pédagogiques invalides", async () => {
  askAIMock.mockResolvedValueOnce({
    success: true,
    provider: "gemini",
    model: "test-model",
    inputTokens: 100,
    outputTokens: 200,
    content: JSON.stringify({
      title: "Introduction à JavaScript",
      introduction: "Présentation du langage.",
      objectives: ["Comprendre JavaScript", ""],
      sections: [
        {
          title: "Les bases",
          content: "Présentation des variables.",
        },
      ],
      conclusion: "Résumé de la leçon.",
    }),
  });

  await expect(
    generateTrainerContent(context, {
      formationId,
      type: "LESSON_CONTENT",
      instructions: "Préparer une introduction à JavaScript.",
    }),
  ).rejects.toMatchObject({
    statusCode: 502,
    message: "Objectifs pédagogiques invalides.",
  });

  expect(draftCreate).not.toHaveBeenCalled();
});
it("refuse une question à choix multiple avec une seule bonne réponse", async () => {
  askAIMock.mockResolvedValueOnce({
    success: true,
    provider: "gemini",
    model: "test-model",
    inputTokens: 100,
    outputTokens: 200,
    content: JSON.stringify({
      title: "Quiz JavaScript",
      description: "Évaluation",
      questions: [
        {
          text: "Quelle affirmation est correcte ?",
          type: "MULTIPLE_CHOICE",
          points: 1,
          options: [
            { text: "Réponse A", isCorrect: true },
            { text: "Réponse B", isCorrect: false },
          ],
          explanation: "Explication.",
        },
      ],
    }),
  });

  await expect(
    generateTrainerContent(context, {
      formationId,
      type: "QUIZ",
      instructions: "Créer un quiz sur JavaScript.",
      questionCount: 1,
    }),
  ).rejects.toMatchObject({
    statusCode: 502,
    message: "Une question à choix multiple doit avoir au moins deux bonnes réponses.",
  });

  expect(draftCreate).not.toHaveBeenCalled();
});

it("refuse une question vrai/faux avec trois propositions", async () => {
  askAIMock.mockResolvedValueOnce({
    success: true,
    provider: "gemini",
    model: "test-model",
    inputTokens: 100,
    outputTokens: 200,
    content: JSON.stringify({
      title: "Quiz JavaScript",
      description: "Évaluation",
      questions: [
        {
          text: "JavaScript est-il un langage de programmation ?",
          type: "TRUE_FALSE",
          points: 1,
          options: [
            { text: "Vrai", isCorrect: true },
            { text: "Faux", isCorrect: false },
            { text: "Peut-être", isCorrect: false },
          ],
          explanation: "JavaScript est un langage de programmation.",
        },
      ],
    }),
  });

  await expect(
    generateTrainerContent(context, {
      formationId,
      type: "QUIZ",
      instructions: "Créer un quiz sur JavaScript.",
      questionCount: 1,
    }),
  ).rejects.toMatchObject({
    statusCode: 502,
    message: "Une question vrai/faux doit avoir deux propositions et une seule bonne réponse.",
  });

  expect(draftCreate).not.toHaveBeenCalled();
});
it("refuse un exercice sans objectif pédagogique", async () => {
  askAIMock.mockResolvedValueOnce({
    success: true,
    provider: "gemini",
    model: "test-model",
    inputTokens: 100,
    outputTokens: 200,
    content: JSON.stringify({
      title: "Exercice JavaScript",
      instructions: "Créer une fonction JavaScript.",
      objectives: [],
      correction: "Utiliser une fonction.",
    }),
  });

  await expect(
    generateTrainerContent(context, {
      formationId,
      type: "EXERCISE",
      instructions: "Préparer un exercice JavaScript.",
    }),
  ).rejects.toMatchObject({
    statusCode: 502,
    message: "Structure de l'exercice généré invalide.",
  });

  expect(draftCreate).not.toHaveBeenCalled();
});
});
