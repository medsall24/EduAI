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
const tenantSlug = `exhausted-integration-${randomUUID()}`;

describe("Learning Path Outbox Exhausted - PostgreSQL integration", () => {
  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: "Exhausted Integration Test Tenant",
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

  it("marks an expired event as FAILED when maximum attempts are reached", async () => {
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

    const event = await prisma.learningPathOutbox.findFirstOrThrow({
      where: {
        tenantId,
        aggregateId,
      },
    });

    const expiredLock = new Date(Date.now() - 3 * 60 * 1000);

    await prisma.learningPathOutbox.update({
      where: { id: event.id },
      data: {
        status: "PROCESSING",
        attempts: 5,
        maxAttempts: 5,
        lockedAt: expiredLock,
        lockedBy: randomUUID(),
        lastError: "Previous worker interrupted.",
      },
    });

    const handler = vi.fn(async () => {});

    startLearningPathOutboxWorker(handler);

    await vi.waitFor(
      async () => {
        const updatedEvent = await prisma.learningPathOutbox.findUnique({
          where: { id: event.id },
        });

        expect(updatedEvent?.status).toBe("FAILED");
      },
      {
        timeout: 10_000,
        interval: 100,
      },
    );

    const failedEvent = await prisma.learningPathOutbox.findUnique({
      where: { id: event.id },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(failedEvent?.attempts).toBe(5);
    expect(failedEvent?.maxAttempts).toBe(5);
    expect(failedEvent?.lockedAt).toBeNull();
    expect(failedEvent?.lockedBy).toBeNull();
    expect(failedEvent?.lastError).toBe("Previous worker interrupted.");
    expect(failedEvent?.processedAt).toBeNull();
  });
});
