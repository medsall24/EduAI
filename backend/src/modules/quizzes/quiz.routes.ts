import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

import {
  createQuizController,
  listQuizzesController,
  getQuizController,
  updateQuizController,
  deleteQuizController,
  createQuestionController,
  listQuestionsController,
  updateQuestionController,
  deleteQuestionController,
  createOptionController,
  listOptionsController,
  updateOptionController,
  deleteOptionController,
  startQuizAttemptController,
  submitQuizAttemptController
} from "./quiz.controller.js";


const router = Router();

/**
 * Liste les Quiz d'une Lesson.
 *
 * Accessible aux utilisateurs possédant la permission quiz.read.
 */
router.get(
  "/lessons/:lessonId/quizzes",
  authenticate,
  requirePermission("quiz.read"),
  listQuizzesController,
);

/**
 * Crée un nouveau Quiz pour une Lesson.
 *
 * Accessible aux utilisateurs possédant la permission quiz.create.
 */
router.post(
  "/lessons/:lessonId/quizzes",
  authenticate,
  requirePermission("quiz.create"),
  createQuizController,
);

/**
 * Récupère un Quiz par son identifiant.
 *
 * Accessible aux utilisateurs possédant la permission quiz.read.
 */
router.get(
  "/quizzes/:quizId",
  authenticate,
  requirePermission("quiz.read"),
  getQuizController,
);

/**
 * Modifie un Quiz existant.
 *
 * Accessible aux utilisateurs possédant la permission quiz.update.
 */
router.patch(
  "/quizzes/:quizId",
  authenticate,
  requirePermission("quiz.update"),
  updateQuizController,
);

/**
 * Supprime un Quiz.
 *
 * Accessible aux utilisateurs possédant la permission quiz.delete.
 */
router.delete(
  "/quizzes/:quizId",
  authenticate,
  requirePermission("quiz.delete"),
  deleteQuizController,
);

/**
 * Crée une nouvelle Question dans un Quiz.
 *
 * Accessible aux utilisateurs possédant la permission quiz.create.
 */
router.post(
  "/quizzes/:quizId/questions",
  authenticate,
  requirePermission("quiz.create"),
  createQuestionController,
);

/**
 * Liste toutes les Questions d'un Quiz.
 *
 * Accessible aux utilisateurs possédant la permission quiz.read.
 */
router.get(
  "/quizzes/:quizId/questions",
  authenticate,
  requirePermission("quiz.read"),
  listQuestionsController,
);

/**
 * Modifie une Question existante.
 *
 * Accessible aux utilisateurs possédant la permission quiz.update.
 */
router.patch(
  "/questions/:questionId",
  authenticate,
  requirePermission("quiz.update"),
  updateQuestionController,
);

/**
 * Supprime une Question.
 *
 * Accessible aux utilisateurs possédant la permission quiz.delete.
 */
router.delete(
  "/questions/:questionId",
  authenticate,
  requirePermission("quiz.delete"),
  deleteQuestionController,
);


/**
 * Crée une option pour une question.
 *
 * L'utilisateur doit être authentifié et posséder la permission quiz.create.
 * Le contrôleur valide les données avant de déléguer la création au service.
 */
router.post(
  "/questions/:questionId/options",
  authenticate,
  requirePermission("quiz.create"),
  createOptionController,
);

/**
 * Liste les options d'une question.
 *
 * La permission quiz.read est obligatoire.
 * Le service applique l'isolation du tenant et masque les corrections
 * pour les utilisateurs qui ne sont pas autorisés à les consulter.
 */
router.get(
  "/questions/:questionId/options",
  authenticate,
  requirePermission("quiz.read"),
  listOptionsController,
);

/**
 * Modifie une option existante.
 *
 * L'utilisateur doit posséder la permission quiz.update.
 */
router.patch(
  "/options/:optionId",
  authenticate,
  requirePermission("quiz.update"),
  updateOptionController,
);

/**
 * Supprime une option existante.
 *
 * L'utilisateur doit posséder la permission quiz.delete.
 */
router.delete(
  "/options/:optionId",
  authenticate,
  requirePermission("quiz.delete"),
  deleteOptionController,
);


/**
 * Démarre une nouvelle tentative de quiz.
 *
 * L'utilisateur doit être authentifié et posséder la permission quiz.submit.
 */
router.post(
  "/quizzes/:quizId/attempts",
  authenticate,
  requirePermission("quiz.submit"),
  startQuizAttemptController,
);


/**
 * Soumet les réponses d'une tentative de quiz.
 *
 * L'utilisateur doit être authentifié et posséder la permission quiz.submit.
 */
router.post(
  "/attempts/:attemptId/submit",
  authenticate,
  requirePermission("quiz.submit"),
  submitQuizAttemptController,
);

export default router;