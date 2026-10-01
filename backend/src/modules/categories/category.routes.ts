import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listCategoriesController,
  updateCategoryController,
} from "./category.controller.js";

const router = Router();

// Récupération de toutes les catégories du tenant connecté.
// Nécessite une authentification et la permission category.read.
router.get(
  "/",
  authenticate,
  requirePermission("category.read"),
  listCategoriesController,
);

// Récupération d'une catégorie par son identifiant.
// L'isolation du tenant est ensuite vérifiée par le service.
router.get(
  "/:id",
  authenticate,
  requirePermission("category.read"),
  getCategoryController,
);

// Création d'une nouvelle catégorie dans le tenant connecté.
// Nécessite la permission category.create.
router.post(
  "/",
  authenticate,
  requirePermission("category.create"),
  createCategoryController,
);

// Modification d'une catégorie existante.
// Nécessite la permission category.update.
router.patch(
  "/:id",
  authenticate,
  requirePermission("category.update"),
  updateCategoryController,
);

// Suppression d'une catégorie.
// Le service vérifie notamment qu'aucune formation ne l'utilise.
// Nécessite la permission category.delete.
router.delete(
  "/:id",
  authenticate,
  requirePermission("category.delete"),
  deleteCategoryController,
);

export default router;