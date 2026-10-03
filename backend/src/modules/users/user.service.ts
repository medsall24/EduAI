import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import { hashPassword } from "../../services/password.service.js";
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UpdateUserStatusInput,
} from "./user.schema.js";

export class UserService {
  /**
   * Vérifie qu'un rôle existe dans le tenant courant.
   * Un rôle d'un autre tenant ne peut jamais être attribué.
   */
  private async ensureRoleExists(
    tenantId: string,
    roleId: string,
  ): Promise<void> {
    const role = await prisma.role.findFirst({
      where: { id: roleId, tenantId },
      select: { id: true },
    });

    if (!role) {
      throw new AppError(400, "Invalid role for this tenant");
    }
  }

  /**
   * Crée un utilisateur dans le tenant courant.
   */
  async create(
    tenantId: string,
    input: CreateUserInput,
  ) {
    await this.ensureRoleExists(tenantId, input.roleId);

    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new AppError(409, "Email is already in use");
    }

    const passwordHash = await hashPassword(input.password);

    return prisma.user.create({
      data: {
        tenantId,
        roleId: input.roleId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
      },
      select: {
        id: true,
        tenantId: true,
        roleId: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Retourne les utilisateurs du tenant avec pagination et recherche.
   */
  async findAll(
    tenantId: string,
    query: ListUsersQuery,
  ) {
    const { page, limit, search } = query;

    const where = {
      tenantId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          tenantId: true,
          roleId: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Recherche un utilisateur uniquement dans le tenant courant.
   */
  async findById(tenantId: string, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        tenantId: true,
        roleId: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return user;
  }

  /**
   * Modifie les informations autorisées d'un utilisateur.
   */
  async update(
    tenantId: string,
    userId: string,
    input: UpdateUserInput,
  ) {
    await this.findById(tenantId, userId);

    if (input.roleId) {
      await this.ensureRoleExists(tenantId, input.roleId);
    }

    if (input.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: input.email,
          NOT: { id: userId },
        },
        select: { id: true },
      });

      if (existingUser) {
        throw new AppError(409, "Email is already in use");
      }
    }

    return prisma.user.update({
  where: {
    tenantId_id: {
      tenantId,
      id: userId,
    },
  },
  data: input,
  select: {
    id: true,
    tenantId: true,
    roleId: true,
    firstName: true,
    lastName: true,
    email: true,
    isActive: true,
    emailVerified: true,
    createdAt: true,
    updatedAt: true,
  },
});
  }

  /**
   * Active ou désactive un compte du tenant courant.
   */
  async updateStatus(
    tenantId: string,
    userId: string,
    input: UpdateUserStatusInput,
  ) {
    await this.findById(tenantId, userId);

    return prisma.user.update({
      where: {
  tenantId_id: {
    tenantId,
    id: userId,
  },
},
      data: { isActive: input.isActive },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Supprime un utilisateur sans supprimer ses inscriptions
   * ni laisser de formations sans formateur.
   */
  async delete(tenantId: string, userId: string) {
    await this.findById(tenantId, userId);

    const [formationCount, enrollmentCount] = await Promise.all([
      prisma.formation.count({
        where: { tenantId, formateurId: userId },
      }),
      prisma.enrollment.count({
        where: { tenantId, userId },
      }),
    ]);

    if (formationCount > 0 || enrollmentCount > 0) {
      throw new AppError(
        409,
        "User cannot be deleted because they are linked to formations or enrollments",
      );
    }

    await prisma.user.delete({
  where: {
    tenantId_id: {
      tenantId,
      id: userId,
    },
  },
});

    return { message: "User deleted successfully" };
  }
}