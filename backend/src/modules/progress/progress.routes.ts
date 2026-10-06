import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { ProgressController } from "./progress.controller.js";

/**
 * Routes HTTP du module de gestion de la progression.
 */
const progressRouter = Router();

/**
 * Instance du contrôleur de progression.
 */
const progressController = new ProgressController();

/**
 * Met à jour la progression d'un apprenant
 * pour une leçon donnée.
 *
 * PATCH /formations/:formationId/progress
 *
 * L'authentification JWT est obligatoire.
 */
progressRouter.patch(
  "/formations/:formationId/progress",
  authenticate,
  progressController.updateProgress.bind(progressController),
);

/**
 * Récupère la progression globale d'un apprenant
 * pour une formation.
 *
 * GET /formations/:formationId/progress
 *
 * Retourne notamment le nombre de leçons terminées
 * et le pourcentage global.
 */
progressRouter.get(
  "/formations/:formationId/progress",
  authenticate,
  progressController.getFormationProgress.bind(
    progressController,
  ),
);

/**
 * Récupère la progression détaillée, leçon par leçon.
 *
 * GET /formations/:formationId/progress/lessons
 *
 * L'authentification JWT est obligatoire.
 */
progressRouter.get(
  "/formations/:formationId/progress/lessons",
  authenticate,
  progressController.getLessonProgress.bind(
    progressController,
  ),
);

export default progressRouter;