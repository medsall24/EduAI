
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
