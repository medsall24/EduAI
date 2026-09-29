import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import {
  createResourceController,
  listResourcesController,
  getResourceController,
  updateResourceController,
  deleteResourceController,
} from "./resource.controller.js";

/**
 * Router dédié à la gestion des ressources pédagogiques.
 */
const router = Router();

/**
 * Liste les ressources d'une leçon.
 *
 * GET /api/lessons/:lessonId/resources
 *
 * Accessible aux utilisateurs possédant la permission resource.read.
 */
router.get(
  "/lessons/:lessonId/resources",
  authenticate,
  requirePermission("resource.read"),
  listResourcesController,
);

/**
 * Crée une nouvelle ressource.
 *
 * POST /api/resources
 *
 * Accessible aux utilisateurs possédant la permission resource.create.
 */
router.post(
  "/resources",
  authenticate,
  requirePermission("resource.create"),
  createResourceController,
);

/**
 * Récupère une ressource précise.
 *
 * GET /api/resources/:id
 *
 * Accessible aux utilisateurs possédant la permission resource.read.
 */
router.get(
  "/resources/:id",
  authenticate,
  requirePermission("resource.read"),
  getResourceController,
);

/**
 * Modifie une ressource existante.
 *
 * PATCH /api/resources/:id
 *
 * Accessible aux utilisateurs possédant la permission resource.update.
 */
router.patch(
  "/resources/:id",
  authenticate,
  requirePermission("resource.update"),
  updateResourceController,
);

/**
 * Supprime une ressource.
 *
 * DELETE /api/resources/:id
 *
 * Accessible aux utilisateurs possédant la permission resource.delete.
 */
router.delete(
  "/resources/:id",
  authenticate,
  requirePermission("resource.delete"),
  deleteResourceController,
);

export default router;