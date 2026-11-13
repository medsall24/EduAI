import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../../src/config/prisma.js";
import { enqueueLearningPathEvent } from "../../src/modules/ai/learning-path-outbox.service.js";

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
const tenantSlug = `integration-${randomUUID()}`;

describe("Learning Path Outbox - PostgreSQL integration", () => {
  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: "Integration Test Tenant",
        slug: tenantSlug,
      },
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: tenantId },
    });

    await prisma.$disconnect();
  });

  it("persists an Outbox event when the transaction commits", async () => {
    const aggregateId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await enqueueLearningPathEvent(tx, {
        tenantId,
        eventType: "ENROLLMENT_ACTIVATED",
        aggregateId,
        payload: {
          userId: randomUUID(),
          formationId: randomUUID(),
        },
      });
    });

    const event = await prisma.learningPathOutbox.findFirst({
      where: {
        tenantId,
        aggregateId,
      },
    });

    expect(event).not.toBeNull();
    expect(event?.eventType).toBe("ENROLLMENT_ACTIVATED");
    expect(event?.status).toBe("PENDING");
    expect(event?.attempts).toBe(0);
  });

  it("does not persist an Outbox event when the transaction rolls back", async () => {
    const aggregateId = randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        await enqueueLearningPathEvent(tx, {
          tenantId,
          eventType: "ENROLLMENT_ACTIVATED",
          aggregateId,
          payload: {
            userId: randomUUID(),
            formationId: randomUUID(),
          },
        });

        throw new Error("Intentional transaction rollback");
      }),
    ).rejects.toThrow("Intentional transaction rollback");

    const event = await prisma.learningPathOutbox.findFirst({
      where: {
        tenantId,
        aggregateId,
      },
    });

    expect(event).toBeNull();
  });
});
