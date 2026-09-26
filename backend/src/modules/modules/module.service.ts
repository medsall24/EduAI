import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import type {
  CreateModuleInput,
  UpdateModuleInput,
} from "./module.schema.js";

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

const ensureFormation = async (
  tenantId: string,
  formationId: string,
): Promise<void> => {
  const formation =
    await prisma.formation.findFirst({
      where: {
        id: formationId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

  if (!formation) {
    throw new AppError(
      400,
      "Formation not found in this tenant",
    );
  }
};

const ensureUniquePosition = async (
  tenantId: string,
  formationId: string,
  position: number,
  excludeModuleId?: string,
): Promise<void> => {
  const existingModule =
    await prisma.module.findFirst({
      where: {
        tenantId,
        formationId,
        position,
        ...(excludeModuleId
          ? {
              id: {
                not: excludeModuleId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

  if (existingModule) {
    throw new AppError(
      409,
      "A module with this position already exists in this formation",
    );
  }
};

export const createModule = async (
  tenantId: string | null,
  input: CreateModuleInput,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  await ensureFormation(
    currentTenantId,
    input.formationId,
  );

  await ensureUniquePosition(
    currentTenantId,
    input.formationId,
    input.position,
  );

  return prisma.module.create({
    data: {
      tenantId: currentTenantId,
      formationId: input.formationId,
      title: input.title,
      description: input.description,
      position: input.position,
      isActive: input.isActive ?? true,
    },
    include: {
      formation: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  });
};

export const listModules = async (
  tenantId: string | null,
  formationId: string,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  await ensureFormation(
    currentTenantId,
    formationId,
  );

  return prisma.module.findMany({
    where: {
      tenantId: currentTenantId,
      formationId,
    },
    orderBy: {
      position: "asc",
    },
  });
};

export const getModuleById = async (
  tenantId: string | null,
  moduleId: string,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  const module =
    await prisma.module.findFirst({
      where: {
        id: moduleId,
        tenantId: currentTenantId,
      },
      include: {
        formation: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        lessons: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });

  if (!module) {
    throw new AppError(
      404,
      "Module not found",
    );
  }

  return module;
};

export const updateModule = async (
  tenantId: string | null,
  moduleId: string,
  input: UpdateModuleInput,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  const existingModule =
    await prisma.module.findFirst({
      where: {
        id: moduleId,
        tenantId: currentTenantId,
      },
      select: {
        id: true,
        formationId: true,
      },
    });

  if (!existingModule) {
    throw new AppError(
      404,
      "Module not found",
    );
  }

  if (input.position !== undefined) {
    await ensureUniquePosition(
      currentTenantId,
      existingModule.formationId,
      input.position,
      moduleId,
    );
  }

  return prisma.module.update({
    where: {
      id: moduleId,
    },
    data: {
      ...(input.title !== undefined
        ? { title: input.title }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.position !== undefined
        ? { position: input.position }
        : {}),
      ...(input.isActive !== undefined
        ? { isActive: input.isActive }
        : {}),
    },
    include: {
      formation: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  });
};

export const deleteModule = async (
  tenantId: string | null,
  moduleId: string,
) => {
  const currentTenantId =
    ensureTenantContext(tenantId);

  const module =
    await prisma.module.findFirst({
      where: {
        id: moduleId,
        tenantId: currentTenantId,
      },
      select: {
        id: true,
      },
    });

  if (!module) {
    throw new AppError(
      404,
      "Module not found",
    );
  }

  await prisma.module.delete({
    where: {
      id: module.id,
    },
  });
};
