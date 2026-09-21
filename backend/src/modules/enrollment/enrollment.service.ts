import { prisma } from "../../config/prisma.js";

export class EnrollmentService {
  async createEnrollment(
    tenantId: string,
    userId: string,
    formationId: string,
  ) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

   if (!user) {
  throw new Error("User not found in this tenant");
}

if (user.systemRole === "SUPER_ADMIN") {
  throw new Error("SUPER_ADMIN cannot be enrolled as a learner");
}

    const formation = await prisma.formation.findFirst({
      where: {
        id: formationId,
        tenantId,
      },
    });

    if (!formation) {
      throw new Error("Formation not found in this tenant");
    }

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        tenantId,
        userId,
        formationId,
      },
    });

    if (existingEnrollment) {
      throw new Error("User is already enrolled in this formation");
    }

    return prisma.enrollment.create({
      data: {
        tenantId,
        userId,
        formationId,
        status: "ACTIVE",
      },
    });
  }
}