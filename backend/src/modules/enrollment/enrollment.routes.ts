import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { EnrollmentController } from "./enrollment.controller.js";

const router = Router();

const enrollmentController = new EnrollmentController();

// Création d'une inscription.
router.post(
  "/",
  authenticate,
  requirePermission("enrollment.create"),
  enrollmentController.create.bind(enrollmentController),
);

// Liste des inscriptions du tenant courant.
router.get(
  "/",
  authenticate,
  requirePermission("enrollment.read"),
  enrollmentController.list.bind(enrollmentController),
);

// Consultation d'une inscription.
router.get(
  "/:id",
  authenticate,
  requirePermission("enrollment.read"),
  enrollmentController.getById.bind(enrollmentController),
);

// Modification du statut d'une inscription.
router.patch(
  "/:id",
  authenticate,
  requirePermission("enrollment.update"),
  enrollmentController.update.bind(enrollmentController),
);

// Suppression d'une inscription.
router.delete(
  "/:id",
  authenticate,
  requirePermission("enrollment.delete"),
  enrollmentController.delete.bind(enrollmentController),
);

export default router;
