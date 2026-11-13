import { randomUUID } from "node:crypto";
import { Client } from "pg";
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
const tenantSlug = `concurrency-integration-${randomUUID()}`;

const clientA = new Client({ connectionString: databaseUrl });
const clientB = new Client({ connectionString: databaseUrl });

describe("Learning Path Outbox Concurrency - PostgreSQL integration", () => {
  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: "Concurrency Integration Test Tenant",
        slug: tenantSlug,
      },
    });

    await Promise.all([clientA.connect(), clientB.connect()]);
  });

    afterAll(async () => {
    await Promise.all([
      clientA.end().catch(() => undefined),
      clientB.end().catch(() => undefined),
    ]);

    await prisma.tenant.deleteMany({
      where: { id: tenantId },
    });

    await prisma.$disconnect();
  });

  it("skips a row locked by another transaction and reclaims it after release", async () => {
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
      where: { tenantId, aggregateId },
    });

    try {
      await clientA.query("BEGIN");

      const lockedRow = await clientA.query(
        `
          SELECT "id"
          FROM "LearningPathOutbox"
          WHERE "id" = $1
          FOR UPDATE
        `,
        [event.id],
      );

      expect(lockedRow.rowCount).toBe(1);

      await clientB.query("BEGIN");

      const skippedRows = await clientB.query(
        `
          SELECT "id"
          FROM "LearningPathOutbox"
          WHERE "id" = $1
          FOR UPDATE SKIP LOCKED
        `,
        [event.id],
      );

      expect(skippedRows.rowCount).toBe(0);

      await clientB.query("COMMIT");
      await clientA.query("COMMIT");

      await clientB.query("BEGIN");

      const reclaimedRows = await clientB.query(
        `
          SELECT "id"
          FROM "LearningPathOutbox"
          WHERE "id" = $1
          FOR UPDATE SKIP LOCKED
        `,
        [event.id],
      );

      expect(reclaimedRows.rowCount).toBe(1);
      expect(reclaimedRows.rows[0]?.id).toBe(event.id);

      await clientB.query("COMMIT");
    } catch (error) {
      await clientB.query("ROLLBACK").catch(() => undefined);
      await clientA.query("ROLLBACK").catch(() => undefined);
      throw error;
    }

    const unchangedEvent = await prisma.learningPathOutbox.findUnique({
      where: { id: event.id },
    });

    expect(unchangedEvent?.status).toBe("PENDING");
    expect(unchangedEvent?.attempts).toBe(0);
    expect(unchangedEvent?.lockedAt).toBeNull();
    expect(unchangedEvent?.lockedBy).toBeNull();
  });
});
