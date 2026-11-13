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
const tenantSlug = `recovery-integration-${randomUUID()}`;

describe("Learning Path Outbox Recovery - PostgreSQL integration", () => {
  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: "Recovery Integration Test Tenant",
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

  it("reclaims and processes an event with an expired lock and remaining attempts", async () => {
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
        attempts: 2,
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

        expect(updatedEvent?.status).toBe("PROCESSED");
      },
      {
        timeout: 10_000,
        interval: 100,
      },
    );

    const processedEvent = await prisma.learningPathOutbox.findUnique({
      where: { id: event.id },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0].attempts).toBe(3);
    expect(processedEvent?.attempts).toBe(3);
    expect(processedEvent?.maxAttempts).toBe(5);
    expect(processedEvent?.lockedAt).toBeNull();
    expect(processedEvent?.lockedBy).toBeNull();
    expect(processedEvent?.processedAt).not.toBeNull();
    expect(processedEvent?.lastError).toBeNull();
  });
});
