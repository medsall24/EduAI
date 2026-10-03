import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import type {
  CreateFormationInput,
  UpdateFormationInput,
} from "./formation.schema.js";

const ensureTenantContext = (tenantId: string | null): string => {
  if (!tenantId) {
    throw new AppError(
      403,
      "Tenant context is required",
    );
  }

  return tenantId;
};

const ensureFormateur = async (
  tenantId: string,
  formateurId: string,
): Promise<void> => {
  const formateur = await prisma.user.findFirst({
    where: {
      id: formateurId,
      tenantId,
      isActive: true,
      role: {
        name: "FORMATEUR",
        tenantId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!formateur) {
    throw new AppError(
      400,
      "Formateur not found in this tenant",
    );
  }
};

const ensureCategory = async (
  tenantId: string,
  categoryId: string,
): Promise<void> => {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      tenantId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    throw new AppError(
      400,
      "Category not found in this tenant",
    );
  }
};

const ensureUniqueSlug = async (
  tenantId: string,
  slug: string,
  excludeFormationId?: string,
): Promise<void> => {
  const existingFormation =
    await prisma.formation.findFirst({
      where: {
        tenantId,
        slug,
        ...(excludeFormationId
          ? {
              id: {
                not: excludeFormationId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

  if (existingFormation) {
    throw new AppError(
      409,
      "A formation with this slug already exists in this tenant",
    );
  }
};

export const createFormation = async (
  tenantId: string | null,
  input: CreateFormationInput,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  await ensureCategory(
    currentTenantId,
    input.categoryId,
  );

  await ensureFormateur(
    currentTenantId,
    input.formateurId,
  );

  await ensureUniqueSlug(
    currentTenantId,
    input.slug,
  );

  return prisma.formation.create({
    data: {
      tenantId: currentTenantId,
      categoryId: input.categoryId,
      formateurId: input.formateurId,
      title: input.title,
      slug: input.slug,
      description: input.description,
      thumbnailUrl: input.thumbnailUrl,
      status: "DRAFT",
    },
    include: {
      category: true,
      formateur: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
};

export const listFormations = async (
  tenantId: string | null,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  return prisma.formation.findMany({
    where: {
      tenantId: currentTenantId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      category: true,
      formateur: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
};

export const getFormationById = async (
  tenantId: string | null,
  formationId: string,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  const formation =
    await prisma.formation.findFirst({
      where: {
        id: formationId,
        tenantId: currentTenantId,
      },
      include: {
        category: true,
        formateur: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        modules: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

  if (!formation) {
    throw new AppError(
      404,
      "Formation not found",
    );
  }

  return formation;
};

export const updateFormation = async (
  tenantId: string | null,
  formationId: string,
  input: UpdateFormationInput,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  const existingFormation =
    await prisma.formation.findUnique({
      where: {
        tenantId_id: {
          tenantId: currentTenantId,
          id: formationId,
        },
      },
      select: {
        id: true,
      },
    });

  if (!existingFormation) {
    throw new AppError(
      404,
      "Formation not found",
    );
  }

  if (input.categoryId) {
    await ensureCategory(
      currentTenantId,
      input.categoryId,
    );
  }

  if (input.formateurId) {
    await ensureFormateur(
      currentTenantId,
      input.formateurId,
    );
  }

  if (input.slug) {
    await ensureUniqueSlug(
      currentTenantId,
      input.slug,
      formationId,
    );
  }

  return prisma.formation.update({
    where: {
      tenantId_id: {
        tenantId: currentTenantId,
        id: formationId,
      },
    },
    data: {
      ...(input.categoryId
        ? { categoryId: input.categoryId }
        : {}),
      ...(input.formateurId
        ? { formateurId: input.formateurId }
        : {}),
      ...(input.title
        ? { title: input.title }
        : {}),
      ...(input.slug
        ? { slug: input.slug }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.thumbnailUrl !== undefined
        ? { thumbnailUrl: input.thumbnailUrl }
        : {}),
      ...(input.status
        ? { status: input.status }
        : {}),
    },
    include: {
      category: true,
      formateur: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
};

export const deleteFormation = async (
  tenantId: string | null,
  formationId: string,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  const result = await prisma.formation.deleteMany({
    where: {
      id: formationId,
      tenantId: currentTenantId,
    },
  });

  if (result.count === 0) {
    throw new AppError(
      404,
      "Formation not found",
    );
  }
};