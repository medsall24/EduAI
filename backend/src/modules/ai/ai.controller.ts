// Service métier chargé de calculer les recommandations pédagogiques.
import { getPedagogicalRecommendations } from "./ai.recommendation.service.js";
import { getLearnerPerformance } from "./ai.performance.service.js";
import type { Request, Response, NextFunction } from "express";

import {
  createConversationSchema,
  conversationIdSchema,
  sendMessageSchema,
  updateConversationSchema,
} from "./ai.schema.js";

import {
  createConversation,
  listConversations,
  getConversation,
  updateConversation,
  deleteConversation,
  sendMessage,
} from "./ai.conversation.service.js";

import {
  generateTrainerContentSchema,
  trainerDraftIdSchema,
  listTrainerDraftsSchema,
  updateTrainerDraftSchema,
  reviewTrainerDraftSchema,
} from "./ai.trainer.schema.js";

import {
  generateTrainerContent,
  listTrainerDrafts,
  getTrainerDraftById,
  updateTrainerDraft,
  reviewTrainerDraft,
} from "./ai.trainer.service.js";

// Construit le contexte de sécurité à partir du JWT authentifié.
function getAIUserContext(req: Request) {
  return {
    userId: req.user?.userId ?? "",
    tenantId: req.user?.tenantId ?? null,
    roleId: req.user?.roleId ?? null,
    systemRole: req.user?.systemRole ?? null,
  };
}

// Crée une conversation pour l'utilisateur connecté.
export async function createConversationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = createConversationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation data",
        errors: validation.error.flatten(),
      });
    }

    const conversation = await createConversation(
      getAIUserContext(req),
      validation.data,
    );

    return res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

// Liste uniquement les conversations de l'utilisateur connecté.
export async function listConversationsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversations = await listConversations(getAIUserContext(req));

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
}

// Récupère une conversation et son historique.
export async function getConversationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = conversationIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
        errors: validation.error.flatten(),
      });
    }

    const conversation = await getConversation(
      getAIUserContext(req),
      validation.data.conversationId,
    );

    return res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

// Modifie le titre d'une conversation.
export async function updateConversationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const paramsValidation = conversationIdSchema.safeParse(req.params);

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
        errors: paramsValidation.error.flatten(),
      });
    }

    const bodyValidation = updateConversationSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation data",
        errors: bodyValidation.error.flatten(),
      });
    }

    const conversation = await updateConversation(
      getAIUserContext(req),
      paramsValidation.data.conversationId,
      bodyValidation.data,
    );

    return res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

// Supprime une conversation appartenant à l'utilisateur.
export async function deleteConversationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = conversationIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
        errors: validation.error.flatten(),
      });
    }

    const result = await deleteConversation(
      getAIUserContext(req),
      validation.data.conversationId,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// Envoie un message à l'assistant et retourne sa réponse.
export async function sendMessageController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const paramsValidation = conversationIdSchema.safeParse(req.params);

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID",
        errors: paramsValidation.error.flatten(),
      });
    }

    const bodyValidation = sendMessageSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid message data",
        errors: bodyValidation.error.flatten(),
      });
    }

    const result = await sendMessage(
      getAIUserContext(req),
      paramsValidation.data.conversationId,
      bodyValidation.data,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retourne les recommandations pédagogiques personnalisées
 * de l'apprenant authentifié.
 *
 * Le service métier vérifie le rôle et applique les filtres
 * nécessaires à l'isolation des données par tenant.
 */
export async function getRecommendationsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Réutilise le contexte construit à partir de l'utilisateur authentifié.
    const recommendations = await getPedagogicalRecommendations(
      getAIUserContext(req),
    );

    // Retourne les recommandations calculées par le backend.
    return res.status(200).json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    // Délègue les erreurs au gestionnaire central d'Express.
    next(error);
  }
}
/**
 * Retourne l'analyse des performances pédagogiques
 * de l'apprenant authentifié.
 *
 * Le service métier vérifie le rôle réel de l'utilisateur,
 * applique l'isolation par tenant et analyse les tentatives terminées.
 */
export async function getPerformanceController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Construit le contexte exclusivement à partir du JWT authentifié.
    const performance = await getLearnerPerformance(
      getAIUserContext(req),
    );

    // Retourne les statistiques pédagogiques de l'apprenant.
    return res.status(200).json({
      success: true,
      data: performance,
    });
  } catch (error) {
    // Transmet les erreurs au gestionnaire central d'Express.
    next(error);
  }
}

// Génère un contenu pédagogique et l'enregistre comme brouillon.
export async function generateTrainerContentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = generateTrainerContentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid trainer content data",
        errors: validation.error.flatten(),
      });
    }

    const draft = await generateTrainerContent(
      getAIUserContext(req),
      validation.data,
    );

    return res.status(201).json({
      success: true,
      data: draft,
    });
  } catch (error) {
    next(error);
  }
}

// Liste les brouillons du formateur avec des filtres facultatifs.
export async function listTrainerDraftsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = listTrainerDraftsSchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid trainer draft filters",
        errors: validation.error.flatten(),
      });
    }

    const drafts = await listTrainerDrafts(
      getAIUserContext(req),
      validation.data,
    );

    return res.status(200).json({
      success: true,
      data: drafts,
    });
  } catch (error) {
    next(error);
  }
}

// Consulte le contenu détaillé d'un brouillon appartenant au formateur.
export async function getTrainerDraftByIdController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validation = trainerDraftIdSchema.safeParse(req.params);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid trainer draft ID",
        errors: validation.error.flatten(),
      });
    }

    const draft = await getTrainerDraftById(
      getAIUserContext(req),
      validation.data.draftId,
    );

    return res.status(200).json({
      success: true,
      data: draft,
    });
  } catch (error) {
    next(error);
  }
}

// Modifie le contenu d'un brouillon encore en attente.
export async function updateTrainerDraftController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const paramsValidation = trainerDraftIdSchema.safeParse(req.params);

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid trainer draft ID",
        errors: paramsValidation.error.flatten(),
      });
    }

    const bodyValidation = updateTrainerDraftSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid trainer draft data",
        errors: bodyValidation.error.flatten(),
      });
    }

    const draft = await updateTrainerDraft(
      getAIUserContext(req),
      paramsValidation.data.draftId,
      bodyValidation.data,
    );

    return res.status(200).json({
      success: true,
      data: draft,
    });
  } catch (error) {
    next(error);
  }
}

// Enregistre la décision humaine du formateur sur un brouillon.
export async function reviewTrainerDraftController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const paramsValidation = trainerDraftIdSchema.safeParse(req.params);

    if (!paramsValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid trainer draft ID",
        errors: paramsValidation.error.flatten(),
      });
    }

    const bodyValidation = reviewTrainerDraftSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid trainer review data",
        errors: bodyValidation.error.flatten(),
      });
    }

    const draft = await reviewTrainerDraft(
      getAIUserContext(req),
      paramsValidation.data.draftId,
      bodyValidation.data,
    );

    return res.status(200).json({
      success: true,
      data: draft,
    });
  } catch (error) {
    next(error);
  }
}