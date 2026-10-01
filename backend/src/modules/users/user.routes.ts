
import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { UserController } from "./user.controller.js";

const router = Router();
const userController = new UserController();

// Création d'un utilisateur dans le tenant courant.
router.post(
  "/",
  authenticate,
  requirePermission("user.create"),
  userController.create.bind(userController),
);

// Liste paginée des utilisateurs du tenant.
router.get(
  "/",
  authenticate,
  requirePermission("user.read"),
  userController.list.bind(userController),
);

// Consultation d'un utilisateur.
router.get(
  "/:id",
  authenticate,
  requirePermission("user.read"),
  userController.getById.bind(userController),
);

// Modification des informations d'un utilisateur.
router.patch(
  "/:id",
  authenticate,
  requirePermission("user.update"),
  userController.update.bind(userController),
);

// Activation ou désactivation d'un compte.
router.patch(
  "/:id/status",
  authenticate,
  requirePermission("user.update"),
  userController.updateStatus.bind(userController),
);

// Suppression d'un utilisateur.
router.delete(
  "/:id",
  authenticate,
  requirePermission("user.delete"),
  userController.delete.bind(userController),
);

export default router;
