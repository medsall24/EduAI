import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./category.schema.js";

// Vérifie que l'utilisateur possède bien un contexte tenant.
// Un utilisateur sans tenant ne peut pas manipuler les catégories tenant-scoped.
const ensureTenantContext = (
  tenantId: string | null,
): string => {
  if (!tenantId) {
    throw new AppError(
      403,
      "Tenant context is required",
    );
  }

  return tenantId;
};

// Vérifie l'unicité du nom d'une catégorie dans le tenant courant.
// Lors d'une modification, la catégorie actuelle est exclue de la recherche.
const ensureUniqueName = async (
  tenantId: string,
  name: string,
  excludeCategoryId?: string,
): Promise<void> => {
  const existingCategory =
    await prisma.category.findFirst({
      where: {
        tenantId,
        name,
        ...(excludeCategoryId
          ? {
              id: {
                not: excludeCategoryId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

  if (existingCategory) {
    throw new AppError(
      409,
      "A category with this name already exists in this tenant",
    );
  }
};

// Vérifie l'unicité du slug d'une catégorie dans le tenant courant.
// Lors d'une modification, la catégorie actuelle est exclue de la recherche.
const ensureUniqueSlug = async (
  tenantId: string,
  slug: string,
  excludeCategoryId?: string,
): Promise<void> => {
  const existingCategory =
    await prisma.category.findFirst({
      where: {
        tenantId,
        slug,
        ...(excludeCategoryId
          ? {
              id: {
                not: excludeCategoryId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

  if (existingCategory) {
    throw new AppError(
      409,
      "A category with this slug already exists in this tenant",
    );
  }
};

// Crée une catégorie dans le tenant de l'utilisateur authentifié.
export const createCategory = async (
  tenantId: string | null,
  input: CreateCategoryInput,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  await ensureUniqueName(
    currentTenantId,
    input.name,
  );

  await ensureUniqueSlug(
    currentTenantId,
    input.slug,
  );

  return prisma.category.create({
    data: {
      tenantId: currentTenantId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      isActive: input.isActive ?? true,
    },
  });
};

// Retourne toutes les catégories appartenant exclusivement au tenant courant.
export const listCategories = async (
  tenantId: string | null,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  return prisma.category.findMany({
    where: {
      tenantId: currentTenantId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          formations: true,
        },
      },
    },
  });
};

// Retourne une catégorie précise appartenant au tenant courant.
// Une catégorie d'un autre tenant est volontairement considérée comme introuvable.
export const getCategoryById = async (
  tenantId: string | null,
  categoryId: string,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  const category =
    await prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId: currentTenantId,
      },
      include: {
        _count: {
          select: {
            formations: true,
          },
        },
      },
    });

  if (!category) {
    throw new AppError(
      404,
      "Category not found",
    );
  }

  return category;
};

// Modifie une catégorie existante dans le tenant courant.
export const updateCategory = async (
  tenantId: string | null,
  categoryId: string,
  input: UpdateCategoryInput,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  const existingCategory =
    await prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId: currentTenantId,
      },
      select: {
        id: true,
      },
    });

  if (!existingCategory) {
    throw new AppError(
      404,
      "Category not found",
    );
  }

  // Vérifie l'unicité uniquement lorsque le nom est modifié.
  if (input.name) {
    await ensureUniqueName(
      currentTenantId,
      input.name,
      categoryId,
    );
  }

  // Vérifie l'unicité uniquement lorsque le slug est modifié.
  if (input.slug) {
    await ensureUniqueSlug(
      currentTenantId,
      input.slug,
      categoryId,
    );
  }

  return prisma.category.update({
    where: {
      id: categoryId,
    },
    data: {
      ...(input.name
        ? { name: input.name }
        : {}),
      ...(input.slug
        ? { slug: input.slug }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.isActive !== undefined
        ? { isActive: input.isActive }
        : {}),
    },
    include: {
      _count: {
        select: {
          formations: true,
        },
      },
    },
  });
};

// Supprime une catégorie uniquement lorsqu'aucune formation ne l'utilise.
export const deleteCategory = async (
  tenantId: string | null,
  categoryId: string,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  const category =
    await prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId: currentTenantId,
      },
      select: {
        id: true,
        _count: {
          select: {
            formations: true,
          },
        },
      },
    });

  if (!category) {
    throw new AppError(
      404,
      "Category not found",
    );
  }

  // Une catégorie utilisée par une formation ne peut pas être supprimée.
  if (category._count.formations > 0) {
    throw new AppError(
      409,
      "Category cannot be deleted because it is used by formations",
    );
  }

  await prisma.category.delete({
    where: {
      id: category.id,
    },
  });
};