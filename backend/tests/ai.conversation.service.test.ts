
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  conversationFindFirst,
  messageCreate,
  messageFindMany,
  usageCreate,
  conversationUpdate,
  askAI,
  getActiveAIConfig,
} = vi.hoisted(() => ({
  conversationFindFirst: vi.fn(),
  messageCreate: vi.fn(),
  messageFindMany: vi.fn(),
  usageCreate: vi.fn(),
  conversationUpdate: vi.fn(),
  askAI: vi.fn(),
  getActiveAIConfig: vi.fn(),
}));


vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    aIConversation: {
      findFirst: conversationFindFirst,
      update: conversationUpdate,
    },
    aIMessage: {
      create: messageCreate,
      findMany: messageFindMany,
    },
    aIUsage: {
      create: usageCreate,
    },
    $transaction: vi.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  },
}));


vi.mock("../src/modules/ai/ai.service.js", () => ({
  askAI,
}));

vi.mock("../src/config/ai.config.js", () => ({
  aiConfig: {
    provider: "gemini",
  },
  getActiveAIConfig,
}));

import { sendMessage } from "../src/modules/ai/ai.conversation.service.js";

const context = {
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "11111111-1111-4111-8111-111111111111",
  roleId: "22222222-2222-4222-8222-222222222222",
  systemRole: null,
};

const conversationId = "44444444-4444-4444-8444-444444444444";

describe("AI conversation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    conversationFindFirst.mockResolvedValue({
      id: conversationId,
      title: "Nouvelle conversation",
    });

    messageCreate.mockResolvedValue({
      id: "message-test",
      role: "USER",
      content: "Explique les variables en programmation.",
      createdAt: new Date(),
    });

    messageFindMany.mockResolvedValue([
      {
        role: "USER",
        content: "Explique les variables en programmation.",
      },
    ]);

    getActiveAIConfig.mockReturnValue({
      apiKey: "test-key",
      model: "test-model",
    });

    askAI.mockRejectedValue(
      new Error("Détail interne simulé du fournisseur"),
    );

    usageCreate.mockResolvedValue({ id: "usage-test" });
  });

  it("enregistre un échec et renvoie une erreur contrôlée si le fournisseur échoue", async () => {
    await expect(
      sendMessage(context, conversationId, {
        content: "Explique les variables en programmation.",
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "AI provider request failed",
    });

    expect(conversationFindFirst).toHaveBeenCalledOnce();
    expect(messageCreate).toHaveBeenCalledOnce();
    expect(askAI).toHaveBeenCalledOnce();

    expect(usageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: context.tenantId,
        userId: context.userId,
        status: "ERROR",
      }),
    });

    expect(conversationUpdate).not.toHaveBeenCalled();
  });


  it("conserve l'erreur contrôlée si la journalisation de l'échec échoue", async () => {
    usageCreate.mockRejectedValueOnce(
      new Error("Erreur de base de données simulée"),
    );

    await expect(
      sendMessage(context, conversationId, {
        content: "Explique les variables en programmation.",
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "AI provider request failed",
    });

    expect(usageCreate).toHaveBeenCalledOnce();
    expect(conversationUpdate).not.toHaveBeenCalled();
  });


it("renvoie une erreur contrôlée si la configuration IA est invalide", async () => {
  getActiveAIConfig.mockImplementationOnce(() => {
    throw new Error("Missing required environment variable: GEMINI_API_KEY");
  });

  await expect(
    sendMessage(context, conversationId, {
      content: "Explique les variables en programmation.",
    }),
  ).rejects.toMatchObject({
    statusCode: 502,
    message: "AI provider request failed",
  });

  expect(askAI).not.toHaveBeenCalled();
  expect(usageCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      tenantId: context.tenantId,
      userId: context.userId,
      status: "ERROR",
    }),
  });
});


it("enregistre la réponse IA et l'utilisation en cas de succès", async () => {
  const assistantMessage = {
    id: "assistant-message-test",
    role: "ASSISTANT",
    content: "Une variable stocke une valeur en mémoire.",
    provider: "GEMINI",
    model: "test-model",
    createdAt: new Date(),
  };

  messageCreate
    .mockResolvedValueOnce({
      id: "message-test",
      role: "USER",
      content: "Explique les variables en programmation.",
      createdAt: new Date(),
    })
    .mockResolvedValueOnce(assistantMessage);

  askAI.mockResolvedValueOnce({
  success: true,
  provider: "gemini",
  model: "test-model",
  content: "Une variable stocke une valeur en mémoire.",
  inputTokens: 120,
  outputTokens: 45,
});

  usageCreate.mockResolvedValueOnce({ id: "usage-test" });
  conversationUpdate.mockResolvedValueOnce({
    id: conversationId,
    title: "Explique les variables en programmation.",
  });

  const result = await sendMessage(context, conversationId, {
    content: "Explique les variables en programmation.",
  });

  expect(result.conversationId).toBe(conversationId);
  expect(result.assistantMessage).toEqual(assistantMessage);
  expect(result.usage.provider).toBe("gemini");
  expect(result.usage.model).toBe("test-model");

  expect(usageCreate).toHaveBeenCalledWith({
  data: expect.objectContaining({
    tenantId: context.tenantId,
    userId: context.userId,
    status: "SUCCESS",
    model: "test-model",
    inputTokens: 120,
    outputTokens: 45,
  }),
});

  expect(conversationUpdate).toHaveBeenCalledOnce();
});



it("refuse d'envoyer un message si la conversation est inaccessible", async () => {
  conversationFindFirst.mockResolvedValueOnce(null);

  await expect(
    sendMessage(context, conversationId, {
      content: "Question privée",
    }),
  ).rejects.toMatchObject({
    statusCode: 404,
    message: "Conversation not found",
  });

  expect(messageCreate).not.toHaveBeenCalled();
  expect(askAI).not.toHaveBeenCalled();
  expect(usageCreate).not.toHaveBeenCalled();
});


  it("ne transforme pas une erreur de chargement de l'historique en erreur IA", async () => {
    // Simule une erreur PostgreSQL lors du chargement de l'historique.
    const databaseError = new Error("Erreur PostgreSQL simulée");
    messageFindMany.mockRejectedValueOnce(databaseError);

    // Vérifie que le service laisse remonter l'erreur de base de données.
    await expect(
      sendMessage(context, conversationId, {
        content: "Explique les variables en programmation.",
      }),
    ).rejects.toBe(databaseError);

    // Le fournisseur IA ne doit pas être appelé.
    expect(askAI).not.toHaveBeenCalled();

    // Aucune utilisation IA ne doit être enregistrée comme un échec fournisseur.
    expect(usageCreate).not.toHaveBeenCalled();

    // Aucune réponse assistant ne doit être enregistrée.
    expect(messageCreate).toHaveBeenCalledOnce();

    // La conversation ne doit pas être actualisée.
    expect(conversationUpdate).not.toHaveBeenCalled();
  });

});
