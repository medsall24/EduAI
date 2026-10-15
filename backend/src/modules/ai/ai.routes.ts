
import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

import {
  createConversationController,
  listConversationsController,
  getConversationController,
  updateConversationController,
  deleteConversationController,
  sendMessageController,
} from "./ai.controller.js";

// Initialise le routeur du module IA.
const router = Router();

// Toutes les routes exigent une authentification et la permission ai.chat.

// Crée une nouvelle conversation.
router.post(
  "/conversations",
  authenticate,
  requirePermission("ai.chat"),
  createConversationController,
);

// Liste les conversations de l'utilisateur connecté.
router.get(
  "/conversations",
  authenticate,
  requirePermission("ai.chat"),
  listConversationsController,
);

// Récupère une conversation et son historique.
router.get(
  "/conversations/:conversationId",
  authenticate,
  requirePermission("ai.chat"),
  getConversationController,
);

// Modifie le titre d'une conversation.
router.patch(
  "/conversations/:conversationId",
  authenticate,
  requirePermission("ai.chat"),
  updateConversationController,
);

// Supprime une conversation et ses messages associés.
router.delete(
  "/conversations/:conversationId",
  authenticate,
  requirePermission("ai.chat"),
  deleteConversationController,
);

// Envoie un message à l'assistant IA dans une conversation.
router.post(
  "/conversations/:conversationId/messages",
  authenticate,
  requirePermission("ai.chat"),
  sendMessageController,
);

export default router;
