import type { Request, Response } from "express";

import { AppError } from "../../errors/app-error.js";
import {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from "./category.schema.js";
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} from "./category.service.js";

// Contrôleur de création d'une catégorie.
export const createCategoryController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = createCategorySchema.safeParse(
    req.body,
  );

  // Vérification des données reçues avant l'appel au service.
  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid category data",
    );
  }

  const category = await createCategory(
    req.user?.tenantId ?? null,
    parsed.data,
  );

  res.status(201).json({
    success: true,
    message: "Category created successfully",
    data: category,
  });
};

// Contrôleur de récupération de toutes les catégories du tenant.
export const listCategoriesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const categories = await listCategories(
    req.user?.tenantId ?? null,
  );

  res.status(200).json({
    success: true,
    data: categories,
  });
};

// Contrôleur de récupération d'une catégorie par son identifiant.
export const getCategoryController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = categoryIdSchema.safeParse(
    req.params,
  );

  // Validation de l'identifiant avant son utilisation.
  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid category ID",
    );
  }

  const category = await getCategoryById(
    req.user?.tenantId ?? null,
    parsed.data.id,
  );

  res.status(200).json({
    success: true,
    data: category,
  });
};

// Contrôleur de modification d'une catégorie.
export const updateCategoryController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Validation de l'identifiant de la catégorie.
  const idParsed = categoryIdSchema.safeParse(
    req.params,
  );

  if (!idParsed.success) {
    throw new AppError(
      400,
      "Invalid category ID",
    );
  }

  // Validation des données de modification.
  const bodyParsed =
    updateCategorySchema.safeParse(req.body);

  if (!bodyParsed.success) {
    throw new AppError(
      400,
      "Invalid category data",
    );
  }

  const category = await updateCategory(
    req.user?.tenantId ?? null,
    idParsed.data.id,
    bodyParsed.data,
  );

  res.status(200).json({
    success: true,
    message: "Category updated successfully",
    data: category,
  });
};

// Contrôleur de suppression d'une catégorie.
export const deleteCategoryController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = categoryIdSchema.safeParse(
    req.params,
  );

  // Validation de l'identifiant avant la suppression.
  if (!parsed.success) {
    throw new AppError(
      400,
      "Invalid category ID",
    );
  }

  await deleteCategory(
    req.user?.tenantId ?? null,
    parsed.data.id,
  );

  res.status(200).json({
    success: true,
    message: "Category deleted successfully",
  });
};