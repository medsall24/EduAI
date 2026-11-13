
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/prisma.js";
import {
  generateLearningPath,
  type LearningPathContext,
} from "../../src/modules/ai/learning-path.service.js";
import { EnrollmentService } from "../../src/modules/enrollment/enrollment.service.js";
import { handleLearningPathEvent } from "../../src/modules/ai/learning-path-event.handler.js";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour les tests d'intégration.");
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");

if (databaseName !== "eduai_test") {
  throw new Error(
    `Sécurité : base incorrecte (${databaseName}). Seule eduai_test est autorisée.`,
  );
}

const tenantId = randomUUID();
const suffix = randomUUID();
const tenantSlug = `integration-${suffix}`;

let context: LearningPathContext;
let formationId: string;
let learnerId: string;
let enrollmentId: string;

const enrollmentService = new EnrollmentService();

describe("Learning path lifecycle - PostgreSQL", () => {
  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: "Learning Path Integration Test",
        slug: tenantSlug,
      },
    });

    const learnerRole = await prisma.role.create({
      data: {
        tenantId,
        name: "APPRENANT",
        description: "Integration test learner",
      },
    });

    const trainerRole = await prisma.role.create({
      data: {
        tenantId,
        name: "FORMATEUR",
        description: "Integration test trainer",
      },
    });

    learnerId = randomUUID();
    const trainerId = randomUUID();

    await prisma.user.createMany({
      data: [
        {
          id: learnerId,
          tenantId,
          roleId: learnerRole.id,
          firstName: "Test",
          lastName: "Learner",
          email: `learner-${suffix}@integration.test`,
          passwordHash: "integration-test-hash",
          isActive: true,
        },
        {
          id: trainerId,
          tenantId,
          roleId: trainerRole.id,
          firstName: "Test",
          lastName: "Trainer",
          email: `trainer-${suffix}@integration.test`,
          passwordHash: "integration-test-hash",
          isActive: true,
        },
      ],
    });

    const category = await prisma.category.create({
      data: {
        tenantId,
        name: `Integration Category ${suffix}`,
        slug: `integration-category-${suffix}`,
      },
    });

    const formation = await prisma.formation.create({
      data: {
        tenantId,
        categoryId: category.id,
        formateurId: trainerId,
        title: "Integration Learning Path Formation",
        slug: `integration-formation-${suffix}`,
        status: "PUBLISHED",
      },
    });

    formationId = formation.id;

    const module = await prisma.module.create({
      data: {
        tenantId,
        formationId,
        title: "Integration Module",
        position: 1,
      },
    });

    await prisma.lesson.create({
      data: {
        tenantId,
        moduleId: module.id,
        title: "Integration Lesson",
        type: "TEXT",
        content: "Integration test lesson content",
        position: 1,
        isActive: true,
      },
    });

    const enrollment = await prisma.enrollment.create({
      data: {
        tenantId,
        formationId,
        userId: learnerId,
        status: "ACTIVE",
      },
    });

    enrollmentId = enrollment.id;

    context = {
      userId: learnerId,
      tenantId,
      roleId: learnerRole.id,
      systemRole: null,
    };
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: tenantId },
    });

    await prisma.$disconnect();
  });

  it("génère un parcours réel et retourne le même parcours lors d'un second appel", async () => {
    const firstResult = await generateLearningPath(context, formationId);

    expect(firstResult).toBeDefined();
    expect(firstResult.tenantId).toBe(tenantId);
    expect(firstResult.userId).toBe(learnerId);
    expect(firstResult.formationId).toBe(formationId);
    expect(firstResult.generationVersion).toBe(1);
    expect(firstResult.steps).toHaveLength(1);
    expect(firstResult.steps[0]?.titleSnapshot).toBe("Integration Lesson");

    const secondResult = await generateLearningPath(context, formationId);

    expect(secondResult.id).toBe(firstResult.id);
    expect(secondResult.steps).toHaveLength(1);

    const paths = await prisma.learningPath.findMany({
      where: {
        tenantId,
        userId: learnerId,
        formationId,
      },
    });

    expect(paths).toHaveLength(1);
  });

 
it("restaure le parcours archivé après réactivation sans perdre la progression", async () => {
  const initialPath = await prisma.learningPath.findFirstOrThrow({
    where: {
      tenantId,
      userId: learnerId,
      formationId,
      status: "ACTIVE",
    },
    include: {
      steps: true,
    },
  });

  // Simuler une leçon déjà terminée.
  const initialStep = initialPath.steps[0];

  expect(initialStep).toBeDefined();

  await prisma.learningPathStep.update({
    where: {
      id: initialStep!.id,
    },
    data: {
      status: "COMPLETED",
    },
  });

  // Annuler l'inscription.
  await enrollmentService.updateEnrollment(
    tenantId,
    enrollmentId,
    { status: "CANCELLED" },
  );

  const cancellationEvent = await prisma.learningPathOutbox.findFirstOrThrow({
    where: {
      tenantId,
      aggregateId: enrollmentId,
      eventType: "ENROLLMENT_CANCELLED",
    },
    orderBy: { createdAt: "desc" },
  });

  await handleLearningPathEvent({
    tenantId: cancellationEvent.tenantId,
    eventId: cancellationEvent.eventId,
    eventType: cancellationEvent.eventType,
    aggregateId: cancellationEvent.aggregateId,
    payload: cancellationEvent.payload,
  });

  const archivedPath = await prisma.learningPath.findFirstOrThrow({
    where: {
      id: initialPath.id,
      tenantId,
    },
    include: {
      steps: true,
    },
  });

  expect(archivedPath.status).toBe("ARCHIVED");
  expect(archivedPath.steps[0]?.status).toBe("COMPLETED");

  // Réactiver l'inscription.
  await enrollmentService.updateEnrollment(
    tenantId,
    enrollmentId,
    { status: "ACTIVE" },
  );

  const activationEvent = await prisma.learningPathOutbox.findFirstOrThrow({
    where: {
      tenantId,
      aggregateId: enrollmentId,
      eventType: "ENROLLMENT_ACTIVATED",
    },
    orderBy: { createdAt: "desc" },
  });

  await handleLearningPathEvent({
    tenantId: activationEvent.tenantId,
    eventId: activationEvent.eventId,
    eventType: activationEvent.eventType,
    aggregateId: activationEvent.aggregateId,
    payload: activationEvent.payload,
  });

  const restoredPath = await prisma.learningPath.findFirstOrThrow({
    where: {
      tenantId,
      userId: learnerId,
      formationId,
    },
    include: {
      steps: true,
    },
  });

  expect(restoredPath.id).toBe(initialPath.id);
  expect(restoredPath.status).toBe("ACTIVE");
  expect(restoredPath.generationVersion).toBe(1);
  expect(restoredPath.steps).toHaveLength(1);
  expect(restoredPath.steps[0]?.id).toBe(initialStep!.id);
  expect(restoredPath.steps[0]?.status).toBe("COMPLETED");

  const paths = await prisma.learningPath.findMany({
    where: {
      tenantId,
      userId: learnerId,
      formationId,
    },
  });

  expect(paths).toHaveLength(1);
});

});
