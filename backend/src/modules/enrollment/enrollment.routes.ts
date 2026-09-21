import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { EnrollmentController } from "./enrollment.controller.js";

// Routes HTTP dédiées à la gestion des inscriptions.
const router = Router();

const enrollmentController = new EnrollmentController();

// Toutes les opérations d'inscription nécessitent un utilisateur authentifié.
router.post(
  "/",
  authenticate,
  enrollmentController.create.bind(enrollmentController),
);

export default router;