import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "../../src/config/prisma.js";
import { enqueueLearningPathEvent } from "../../src/modules/ai/learning-path-outbox.service.js";
import {
  startLearningPathOutboxWorker,
  stopLearningPathOutboxWorker,
} from "../../src/modules/ai/learning-path-outbox.worker.js";

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
const tenantSlug = `retry-integration-${randomUUID()}`;

describe("Learning Path Outbox Retry - PostgreSQL integration", () => {
  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: "Retry Integration Test Tenant",
        slug: tenantSlug,
      },
    });
  });

  afterAll(async () => {
    await stopLearningPathOutboxWorker();

    await prisma.tenant.deleteMany({
      where: { id: tenantId },
    });

    await prisma.$disconnect();
  });

  it("reschedules an event after a temporary handler failure", async () => {
    const aggregateId = randomUUID();
    const failureMessage = "Temporary integration test failure";

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

    const handler = vi.fn(async () => {
      throw new Error(failureMessage);
    });

    startLearningPathOutboxWorker(handler);

    await vi.waitFor(
      async () => {
        const event = await prisma.learningPathOutbox.findFirst({
          where: {
            tenantId,
            aggregateId,
          },
        });

        expect(event?.attempts).toBe(1);
        expect(event?.status).toBe("PENDING");
      },
      {
        timeout: 10_000,
        interval: 100,
      },
    );

    const event = await prisma.learningPathOutbox.findFirst({
      where: {
        tenantId,
        aggregateId,
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(event?.lastError).toBe(failureMessage);
    expect(event?.maxAttempts).toBe(5);
    expect(event?.lockedAt).toBeNull();
    expect(event?.lockedBy).toBeNull();
    expect(event?.processedAt).toBeNull();
    expect(event?.nextRetryAt.getTime()).toBeGreaterThan(Date.now());
  });
});
