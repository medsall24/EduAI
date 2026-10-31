
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


/**
 * Enregistre l'échec d'une requête auprès du fournisseur IA,
 * puis renvoie une erreur contrôlée destinée au client.
 *
 * Cette fonction :
 * 1. Récupère un message d'erreur exploitable pour les logs.
 * 2. Journalise l'échec côté serveur.
 * 3. Tente d'enregistrer l'utilisation avec le statut ERROR.
 * 4. Ignore une éventuelle erreur de journalisation pour
 *    préserver l'erreur initiale du fournisseur.
 * 5. Retourne une erreur HTTP 502 sans exposer les détails internes.
 *
 * @param tenantId Identifiant du tenant concerné.
 * @param userId Identifiant de l'utilisateur authentifié.
 * @param provider Fournisseur IA utilisé : Gemini ou OpenRouter.
 * @param model Modèle IA utilisé, ou valeur de remplacement si
 *              la configuration n'a pas pu être récupérée.
 * @param startedAt Horodatage du début du traitement, en millisecondes.
 * @param error Erreur initiale rencontrée pendant la requête IA.
 * @returns Une promesse qui se termine toujours par une erreur contrôlée.
 */
async function recordAIProviderFailure(
  tenantId: string,
  userId: string,
  provider: "gemini" | "openrouter",
  model: string,
  startedAt: number,
  error: unknown,
): Promise<never> {
  // Convertit l'erreur en message lisible sans supposer son type.
  const errorMessage =
    error instanceof Error ? error.message : "Unknown error";

  // Journalise les informations utiles au diagnostic côté serveur.
  // Ces détails ne sont pas directement renvoyés au client.
  console.error("[EduAI AI] Provider request failed:", {
    provider,
    error: errorMessage,
  });

  try {
    // Enregistre la tentative échouée dans les statistiques d'utilisation.
    await prisma.aIUsage.create({
      data: {
        tenantId,
        userId,

        // Convertit le nom du fournisseur vers l'enum Prisma correspondant.
        provider:
          provider === "gemini"
            ? AIProvider.GEMINI
            : AIProvider.OPENROUTER,

        // Conserve le modèle utilisé ou la valeur de remplacement fournie.
        model,

        // Calcule la durée totale écoulée depuis le début du traitement.
        durationMs: Date.now() - startedAt,

        // Indique que la requête IA n'a pas abouti.
        status: AIRequestStatus.ERROR,
      },
    });
  } catch {
    // La journalisation ne doit pas remplacer l'erreur initiale.
    // L'échec d'écriture dans la table d'utilisation est donc ignoré ici.
  }

  // Renvoie un message contrôlé au client sans exposer les détails internes.
  throw new AppError(502, "AI provider request failed");
}



/**
 * Enregistre le message utilisateur, appelle le fournisseur IA,
 * sauvegarde la réponse et journalise l'utilisation.
 */
export async function sendMessage(
  context: AIUserContext,
  conversationId: string,
  input: SendMessageInput,
) {
  // Vérifie le contexte de sécurité et récupère le tenant courant.
  const tenantId = ensureTenantContext(context);

  // Vérifie que la conversation appartient à l'utilisateur authentifié.
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

  // Ne révèle pas l'existence d'une conversation inaccessible.
  if (!conversation) {
    throw new AppError(404, "Conversation not found");
  }

  // Enregistre le message utilisateur avant l'appel au fournisseur IA.
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

  // Démarre le chronométrage et récupère le fournisseur configuré.
  const startedAt = Date.now();
  const provider = aiConfig.provider;

  // Vérifie la configuration avant de poursuivre.
  let model: string;

  try {
    model = getActiveAIConfig().model;
  } catch (error: unknown) {
    // Une configuration invalide est traitée comme un échec du service IA.
    return recordAIProviderFailure(
      tenantId,
      context.userId,
      provider,
      "unknown",
      startedAt,
      error,
    );
  }

  // Charge l'historique récent de la conversation.
  // Une erreur PostgreSQL ici reste une erreur de base de données.
  const history = await prisma.aIMessage.findMany({
    where: {
      tenantId,
      conversationId,
      role: {
        in: [AIMessageRole.USER, AIMessageRole.ASSISTANT],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: MAX_HISTORY_MESSAGES,
    select: {
      role: true,
      content: true,
    },
  });

  // Remet les messages dans l'ordre chronologique attendu par le modèle.
  const messages: AIMessage[] = history.reverse().map((message) => ({
    role: message.role === AIMessageRole.ASSISTANT ? "assistant" : "user",
    content: message.content,
  }));

  // Appelle le fournisseur IA dans un bloc isolé.
  // Seule une erreur de cet appel déclenche la journalisation d'échec IA.
  let response;

  try {
    response = await askAI(messages, AI_SYSTEM_INSTRUCTION);
  } catch (error: unknown) {
    return recordAIProviderFailure(
      tenantId,
      context.userId,
      provider,
      model,
      startedAt,
      error,
    );
  }

  // Calcule la durée de la requête IA réussie.
  const durationMs = Date.now() - startedAt;

  // Enregistre la réponse de l'assistant.
  // Une erreur Prisma remonte normalement au middleware d'erreurs.
  const assistantMessage = await prisma.aIMessage.create({
    data: {
      tenantId,
      conversationId,
      role: AIMessageRole.ASSISTANT,
      content: response.content,
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

  // Enregistre l'utilisation réussie et actualise la conversation.
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

    // Enregistre le nombre de tokens consommés.
    // Une valeur indisponible est conservée sous forme de null.
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,

    // Enregistre la durée totale de la requête.
    durationMs,

    // Indique que la requête IA a réussi.
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
        // Définit le titre à partir du premier message si nécessaire.
        ...(conversation.title === "Nouvelle conversation"
          ? { title: input.content.slice(0, 60).trim() }
          : {}),
      },
    }),
  ]);

  // Retourne les messages et les informations d'utilisation au contrôleur.
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
}
