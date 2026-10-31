import { Router } from "express";

// Middleware d'authentification JWT.
import { authenticate } from "../../middlewares/auth.middleware.js";

// Middleware de vérification de la permission d'accès à l'assistant IA.
import { requirePermission } from "../../middlewares/permission.middleware.js";

// Limiteur spécifique aux messages envoyés à l'assistant IA.
import { aiMessageRateLimit } from "../../middlewares/ai-rate-limit.middleware.js";

// Contrôleurs responsables du traitement des requêtes du module IA.
import {
  createConversationController,
  listConversationsController,
  getConversationController,
  updateConversationController,
  deleteConversationController,
  sendMessageController,
  getRecommendationsController,
} from "./ai.controller.js";

// Initialise le routeur Express du module IA.
const router = Router();

// Toutes les routes du module IA nécessitent une authentification
// et la permission "ai.chat".

// Crée une nouvelle conversation avec l'assistant IA.
router.post(
  "/conversations",
  authenticate,
  requirePermission("ai.chat"),
  createConversationController,
);

// Retourne la liste des conversations de l'utilisateur connecté.
router.get(
  "/conversations",
  authenticate,
  requirePermission("ai.chat"),
  listConversationsController,
);

// Récupère une conversation ainsi que son historique de messages.
router.get(
  "/conversations/:conversationId",
  authenticate,
  requirePermission("ai.chat"),
  getConversationController,
);

// Modifie les informations d'une conversation, notamment son titre
// ou son statut d'archivage.
router.patch(
  "/conversations/:conversationId",
  authenticate,
  requirePermission("ai.chat"),
  updateConversationController,
);

// Supprime une conversation appartenant à l'utilisateur connecté.
router.delete(
  "/conversations/:conversationId",
  authenticate,
  requirePermission("ai.chat"),
  deleteConversationController,
);

// Envoie un message à l'assistant pédagogique IA.
// Le limiteur intervient après l'authentification et la vérification
// de la permission afin de limiter les requêtes par utilisateur et par tenant.
router.post(
  "/conversations/:conversationId/messages",
  authenticate,
  requirePermission("ai.chat"),
  aiMessageRateLimit,
  sendMessageController,
);

// Retourne les recommandations pédagogiques de l'apprenant authentifié.
router.get(
  "/recommendations",
  authenticate,
  requirePermission("ai.chat"),
  getRecommendationsController,
);

// Exporte le routeur pour son intégration dans l'application Express.
export default router;