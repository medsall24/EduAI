
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import {
  AIMessageRole,
  AIProvider,
  AIRequestStatus,
} from "../../generated/prisma/enums.js";
import { aiConfig, getActiveAIConfig } from "../../config/ai.config.js";
import { askAI } from "./ai.service.js";
import type { AIMessage } from "./ai.service.js";
import type {
  CreateConversationInput,
  SendMessageInput,
  UpdateConversationInput,
} from "./ai.schema.js";

// Contexte de sécurité de l'utilisateur authentifié.
export type AIUserContext = {
  userId: string;
  tenantId: string | null;
  roleId: string | null;
  systemRole: "SUPER_ADMIN" | null;
};

// Vérifie la présence du tenant et de l'utilisateur authentifié.
function ensureTenantContext(context: AIUserContext): string {
  if (!context.tenantId) {
    throw new AppError(403, "Tenant context is required");
  }

  if (!context.userId) {
    throw new AppError(401, "Authentication is required");
  }

  return context.tenantId;
}

// Crée une conversation appartenant à l'utilisateur et à son tenant.
export async function createConversation(
  context: AIUserContext,
  input: CreateConversationInput,
) {
  const tenantId = ensureTenantContext(context);

  return prisma.aIConversation.create({
    data: {
      tenantId,
      userId: context.userId,
      ...(input.title ? { title: input.title } : {}),
    },
    // Retourne uniquement les informations utiles de la conversation.
    select: {
      id: true,
      title: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// Liste les conversations de l'utilisateur connecté, les plus récentes d'abord.
export async function listConversations(context: AIUserContext) {
  const tenantId = ensureTenantContext(context);

  return prisma.aIConversation.findMany({
    // Le filtrage par tenant et propriétaire protège la confidentialité.
    where: {
      tenantId,
      userId: context.userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      // Retourne le nombre de messages sans charger leur contenu.
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });
}

// Récupère une conversation et ses messages uniquement pour son propriétaire.
export async function getConversation(
  context: AIUserContext,
  conversationId: string,
) {
  const tenantId = ensureTenantContext(context);

  const conversation = await prisma.aIConversation.findFirst({
    // Empêche l'accès aux conversations d'un autre utilisateur ou tenant.
    where: {
      id: conversationId,
      tenantId,
      userId: context.userId,
    },
    include: {
      // Charge les messages dans l'ordre chronologique.
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  // Retourne la même erreur si la conversation est absente ou inaccessible.
  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }

  return conversation;
}

// Modifie le titre d'une conversation appartenant à l'utilisateur.
export async function updateConversation(
  context: AIUserContext,
  conversationId: string,
  input: UpdateConversationInput,
) {
  const tenantId = ensureTenantContext(context);

  // Vérifie que la conversation appartient au propriétaire authentifié.
  const conversation = await prisma.aIConversation.findFirst({
    where: {
      id: conversationId,
      tenantId,
      userId: context.userId,
    },
    select: {
      id: true,
    },
  });

  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }

  return prisma.aIConversation.update({
    // Utilise la clé composite tenantId + id définie dans Prisma.
    where: {
      tenantId_id: {
        tenantId,
        id: conversationId,
      },
    },
    data: {
  ...(input.title !== undefined ? { title: input.title } : {}),
  ...(input.isArchived !== undefined
    ? { isArchived: input.isArchived }
    : {}),
},
    select: {
      id: true,
      title: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// Supprime une conversation appartenant à l'utilisateur authentifié.
export async function deleteConversation(
  context: AIUserContext,
  conversationId: string,
) {
  const tenantId = ensureTenantContext(context);

  // Vérifie le propriétaire avant la suppression.
  const conversation = await prisma.aIConversation.findFirst({
    where: {
      id: conversationId,
      tenantId,
      userId: context.userId,
    },
    select: {
      id: true,
    },
  });

  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }

  // Supprime la conversation ciblée dans le tenant courant.
  await prisma.aIConversation.delete({
    where: {
      tenantId_id: {
        tenantId,
        id: conversationId,
      },
    },
  });

  return { success: true };
}

// Instruction pédagogique transmise au fournisseur IA.
const AI_SYSTEM_INSTRUCTION =
  "Tu es l'assistant pédagogique d'EduAI. Réponds de manière claire, " +
  "précise et pédagogique. Adapte tes explications au niveau de l'apprenant. " +
  "Si une question est ambiguë, demande une clarification.";

// Nombre maximal de messages précédents chargés pour fournir le contexte à l'IA.
const MAX_HISTORY_MESSAGES = 20;

// Enregistre un message utilisateur, appelle l'IA et sauvegarde sa réponse.
export async function sendMessage(
  context: AIUserContext,
  conversationId: string,
  input: SendMessageInput,
) {
  const tenantId = ensureTenantContext(context);

  // Vérifie que la conversation appartient au tenant et à l'utilisateur.
  const conversation = await prisma.aIConversation.findFirst({
    where: {
      id: conversationId,
      tenantId,
      userId: context.userId,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }

  // Enregistre le message de l'utilisateur dans PostgreSQL.
  const userMessage = await prisma.aIMessage.create({
    data: {
      tenantId,
      conversationId,
      role: AIMessageRole.USER,
      content: input.content,
    },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  // Démarre la mesure du temps de traitement de la requête.
  const startedAt = Date.now();

  // Récupère le fournisseur configuré pour cette requête.
  const provider = aiConfig.provider;
  let model: string;

  try {
    // Vérifie la configuration du fournisseur et récupère son modèle.
    model = getActiveAIConfig().model;

    // Charge les messages récents pour conserver le contexte de la conversation.
    const history = await prisma.aIMessage.findMany({
      where: {
        tenantId,
        conversationId,
        // Seuls les messages utilisateur et assistant sont transmis à l'IA.
        role: {
          in: [AIMessageRole.USER, AIMessageRole.ASSISTANT],
        },
      },
      // Charge les messages les plus récents en premier.
      orderBy: {
        createdAt: "desc",
      },
      take: MAX_HISTORY_MESSAGES,
      select: {
        role: true,
        content: true,
      },
    });

    // Remet l'historique dans l'ordre chronologique et convertit les rôles.
    const messages: AIMessage[] = history.reverse().map((message) => ({
      role: message.role === AIMessageRole.ASSISTANT ? "assistant" : "user",
      content: message.content,
    }));

    // Envoie l'historique au fournisseur IA actif.
    const response = await askAI(messages, AI_SYSTEM_INSTRUCTION);
    const durationMs = Date.now() - startedAt;

    // Enregistre la réponse générée par l'assistant.
    const assistantMessage = await prisma.aIMessage.create({
      data: {
        tenantId,
        conversationId,
        role: AIMessageRole.ASSISTANT,
        content: response.content,
        // Convertit le fournisseur en valeur de l'enum Prisma.
        provider:
          response.provider === "gemini"
            ? AIProvider.GEMINI
            : AIProvider.OPENROUTER,
        model: response.model,
      },
      select: {
        id: true,
        role: true,
        content: true,
        provider: true,
        model: true,
        createdAt: true,
      },
    });

    // Enregistre les statistiques de succès et actualise la conversation.
    await prisma.$transaction([
      prisma.aIUsage.create({
        data: {
          tenantId,
          userId: context.userId,
          provider:
            response.provider === "gemini"
              ? AIProvider.GEMINI
              : AIProvider.OPENROUTER,
          model: response.model,
          durationMs,
          status: AIRequestStatus.SUCCESS,
        },
      }),
      prisma.aIConversation.update({
        where: {
          tenantId_id: {
            tenantId,
            id: conversationId,
          },
        },
        data: {
          updatedAt: new Date(),
          // Utilise le début du premier message comme titre provisoire.
          ...(conversation.title === "Nouvelle conversation"
            ? {
                title: input.content.slice(0, 60).trim(),
              }
            : {}),
        },
      }),
    ]);

    // Retourne le message envoyé, la réponse et les informations d'utilisation.
    return {
      conversationId,
      userMessage,
      assistantMessage,
      usage: {
        provider: response.provider,
        model: response.model,
        durationMs,
      },
    };
  } catch (error: unknown) {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown error";

  console.error("[EduAI AI] Provider request failed:", {
    provider,
    error: errorMessage,
  });
    // Calcule la durée même lorsque le traitement échoue.
    const durationMs = Date.now() - startedAt;

    try {
      // Enregistre l'échec sans exposer les détails sensibles au client.
      const fallbackModel =
        typeof model! === "string"
          ? model!
          : provider === "gemini"
            ? "unknown"
            : "unknown";

      await prisma.aIUsage.create({
        data: {
          tenantId,
          userId: context.userId,
          provider:
            provider === "gemini"
              ? AIProvider.GEMINI
              : AIProvider.OPENROUTER,
          model: fallbackModel,
          durationMs,
          status: AIRequestStatus.ERROR,
        },
      });
    } catch {
      // Une erreur de journalisation ne remplace pas l'erreur initiale.
    }

    // Retourne une erreur contrôlée sans divulguer les détails du fournisseur.
    throw new AppError(502, "AI provider request failed");
  }
}
