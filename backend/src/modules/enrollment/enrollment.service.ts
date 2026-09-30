import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/app-error.js";
import type {
  CreateEnrollmentInput,
  UpdateEnrollmentInput,
} from "./enrollment.schema.js";

export class EnrollmentService {
  /**
   * Récupère le rôle applicatif de l'utilisateur authentifié.
   *
   * La vérification du tenant est volontairement effectuée
   * dans la même requête afin d'empêcher l'utilisation
   * d'un rôle provenant d'un autre tenant.
   */
  private async getRoleName(
    tenantId: string,
    roleId: string,
  ): Promise<string> {
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId,
      },
      select: {
        name: true,
      },
    });

    if (!role) {
      throw new AppError(
        403,
        "User role is invalid for this tenant",
      );
    }

    return role.name;
  }

  /**
   * Crée une inscription dans le tenant courant.
   *
   * Règle de sécurité :
   * - TENANT_ADMIN peut inscrire un utilisateur du tenant ;
   * - APPRENANT peut uniquement s'inscrire lui-même.
   */
  async createEnrollment(
    tenantId: string,
    actorUserId: string,
    actorRoleId: string,
    input: CreateEnrollmentInput,
  ) {
    const roleName = await this.getRoleName(
      tenantId,
      actorRoleId,
    );

    // Un apprenant ne peut jamais inscrire un autre utilisateur.
    if (
      roleName === "APPRENANT" &&
      input.userId !== actorUserId
    ) {
      throw new AppError(
        403,
        "An APPRENANT can only enroll themselves",
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        id: input.userId,
        tenantId,
      },
    });

    if (!user) {
      throw new AppError(
        404,
        "User not found in this tenant",
      );
    }

    // Le SUPER_ADMIN ne doit pas être inscrit comme apprenant.
    if (user.systemRole === "SUPER_ADMIN") {
      throw new AppError(
        400,
        "SUPER_ADMIN cannot be enrolled as a learner",
      );
    }

    const formation = await prisma.formation.findFirst({
      where: {
        id: input.formationId,
        tenantId,
      },
    });

    if (!formation) {
      throw new AppError(
        404,
        "Formation not found in this tenant",
      );
    }

    const existingEnrollment =
      await prisma.enrollment.findFirst({
        where: {
          tenantId,
          userId: input.userId,
          formationId: input.formationId,
        },
      });

    if (existingEnrollment) {
      throw new AppError(
        409,
        "User is already enrolled in this formation",
      );
    }

    return prisma.enrollment.create({
      data: {
        tenantId,
        userId: input.userId,
        formationId: input.formationId,
        status: "ACTIVE",
      },
    });
  }

  /**
   * Retourne les inscriptions visibles par l'utilisateur.
   *
   * Un APPRENANT ne peut consulter que ses propres inscriptions.
   * Les autres utilisateurs autorisés peuvent consulter
   * les inscriptions du tenant courant.
   */
  async listEnrollments(
    tenantId: string,
    actorUserId: string,
    actorRoleId: string,
  ) {
    const roleName = await this.getRoleName(
      tenantId,
      actorRoleId,
    );

    const where =
      roleName === "APPRENANT"
        ? {
            tenantId,
            userId: actorUserId,
          }
        : {
            tenantId,
          };

    return prisma.enrollment.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

    /**
   * Retourne une inscription appartenant au tenant courant.
   *
   * Un APPRENANT ne peut consulter que ses propres inscriptions.
   */
  async getEnrollmentById(
    tenantId: string,
    actorUserId: string,
    actorRoleId: string,
    id: string,
  ) {
    const roleName = await this.getRoleName(
      tenantId,
      actorRoleId,
    );

    const enrollment =
      await prisma.enrollment.findFirst({
        where: {
          id,
          tenantId,
          ...(roleName === "APPRENANT"
            ? {
                userId: actorUserId,
              }
            : {}),
        },
      });

    if (!enrollment) {
      throw new AppError(
        404,
        "Enrollment not found",
      );
    }

    return enrollment;
  }

  /**
   * Modifie le statut d'une inscription.
   */
  async updateEnrollment(
    tenantId: string,
    id: string,
    input: UpdateEnrollmentInput,
  ) {
    const existingEnrollment =
      await prisma.enrollment.findFirst({
        where: {
          id,
          tenantId,
        },
      });

    if (!existingEnrollment) {
      throw new AppError(
        404,
        "Enrollment not found",
      );
    }

    // Une date de fin est créée uniquement lorsque
    // l'inscription passe à l'état COMPLETED.
    const completedAt =
      input.status === "COMPLETED"
        ? existingEnrollment.completedAt ??
          new Date()
        : null;

    return prisma.enrollment.update({
      where: {
        id,
      },
      data: {
        status: input.status,
        completedAt,
      },
    });
  }

  /**
   * Supprime une inscription appartenant au tenant courant.
   */
  async deleteEnrollment(
    tenantId: string,
    id: string,
  ): Promise<void> {
    const existingEnrollment =
      await prisma.enrollment.findFirst({
        where: {
          id,
          tenantId,
        },
      });

    if (!existingEnrollment) {
      throw new AppError(
        404,
        "Enrollment not found",
      );
    }

    await prisma.enrollment.delete({
      where: {
        id,
      },
    });
  }
}
