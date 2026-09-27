import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import {
  createLessonController,
  listLessonsController,
  getLessonController,
  updateLessonController,
  deleteLessonController,
} from "./lesson.controller.js";

const router = Router();

/**
 * Liste les leçons d'un module.
 * Accessible aux utilisateurs possédant la permission lesson.read.
 */
router.get(
  "/modules/:moduleId/lessons",
  authenticate,
  requirePermission("lesson.read"),
  listLessonsController,
);

/**
 * Crée une nouvelle leçon.
 * Accessible aux utilisateurs possédant la permission lesson.create.
 */
router.post(
  "/lessons",
  authenticate,
  requirePermission("lesson.create"),
  createLessonController,
);

/**
 * Récupère une leçon par son identifiant.
 * Accessible aux utilisateurs possédant la permission lesson.read.
 */
router.get(
  "/lessons/:id",
  authenticate,
  requirePermission("lesson.read"),
  getLessonController,
);

/**
 * Modifie une leçon existante.
 * Accessible aux utilisateurs possédant la permission lesson.update.
 */
router.patch(
  "/lessons/:id",
  authenticate,
  requirePermission("lesson.update"),
  updateLessonController,
);

/**
 * Supprime une leçon.
 * Accessible aux utilisateurs possédant la permission lesson.delete.
 */
router.delete(
  "/lessons/:id",
  authenticate,
  requirePermission("lesson.delete"),
  deleteLessonController,
);

export default router;
