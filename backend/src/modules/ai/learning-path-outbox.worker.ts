
import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import type { LearningPathEventType } from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";

interface OutboxEvent {
  id: string;
  tenantId: string;
  eventId: string;
  eventType: LearningPathEventType;
  aggregateId: string;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
}

type EventHandler = (event: OutboxEvent) => Promise<void>;

const BATCH_SIZE = 10;
const POLLING_INTERVAL_MS = 5000;
const LOCK_TIMEOUT_MINUTES = 2;

const workerId = randomUUID();

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let stopping = false;
let currentRun: Promise<void> | null = null;

/**
 * Récupère atomiquement les événements disponibles.
 * SKIP LOCKED permet à plusieurs workers de travailler sans conflit.
 */

async function claimEvents(): Promise<OutboxEvent[]> {
  return prisma.$transaction(async (tx) => {
    return tx.$queryRaw<OutboxEvent[]>(Prisma.sql`
      WITH exhausted AS (
        UPDATE "LearningPathOutbox"
        SET
          "status" = 'FAILED',
          "lockedAt" = NULL,
          "lockedBy" = NULL,
          "lastError" = COALESCE(
            "lastError",
            'Nombre maximal de tentatives atteint après interruption du worker.'
          ),
          "updatedAt" = NOW()
        WHERE
          "status" = 'PROCESSING'
          AND "lockedAt" < NOW() - (${LOCK_TIMEOUT_MINUTES} * INTERVAL '1 minute')
          AND "attempts" >= "maxAttempts"
        RETURNING "id"
      ),
      candidates AS (
        SELECT "id"
        FROM "LearningPathOutbox"
        WHERE
          (
            "status" = 'PENDING'
            AND "nextRetryAt" <= NOW()
          )
          OR
          (
            "status" = 'PROCESSING'
            AND "lockedAt" < NOW() - (${LOCK_TIMEOUT_MINUTES} * INTERVAL '1 minute')
            AND "attempts" < "maxAttempts"
          )
        ORDER BY "createdAt" ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "LearningPathOutbox" AS event
      SET
        "status" = 'PROCESSING',
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId},
        "attempts" = event."attempts" + 1,
        "updatedAt" = NOW()
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING
        event."id",
        event."tenantId",
        event."eventId",
        event."eventType",
        event."aggregateId",
        event."payload",
        event."attempts",
        event."maxAttempts"
    `);
  });
}


/**
 * Marque un événement comme traité.
 */
async function markAsProcessed(event: OutboxEvent): Promise<void> {
  await prisma.learningPathOutbox.updateMany({
    where: {
      id: event.id,
      tenantId: event.tenantId,
      status: "PROCESSING",
      lockedBy: workerId,
    },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

/**
 * Enregistre l'échec et programme une nouvelle tentative.
 */
async function markAsFailed(
  event: OutboxEvent,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message : "Erreur inconnue";

  const permanentFailure = event.attempts >= event.maxAttempts;

  const delaySeconds = Math.min(
    2 ** event.attempts * 5,
    900,
  );

  await prisma.learningPathOutbox.updateMany({
    where: {
      id: event.id,
      tenantId: event.tenantId,
      status: "PROCESSING",
      lockedBy: workerId,
    },
    data: {
      status: permanentFailure ? "FAILED" : "PENDING",
      nextRetryAt: new Date(Date.now() + delaySeconds * 1000),
      lockedAt: null,
      lockedBy: null,
      lastError: message.slice(0, 1000),
    },
  });
}

/**
 * Traite un événement indépendamment des autres.
 */
async function processEvent(
  event: OutboxEvent,
  handler: EventHandler,
): Promise<void> {
  try {
    await handler(event);
    await markAsProcessed(event);
  } catch (error) {
    console.error(
      `[LearningPathOutbox] Échec événement ${event.eventId}:`,
      error,
    );

    try {
      await markAsFailed(event, error);
    } catch (updateError) {
      console.error(
        `[LearningPathOutbox] Impossible d'enregistrer l'échec ${event.eventId}:`,
        updateError,
      );
    }
  }
}

/**
 * Exécute un cycle de traitement.
 */
async function runCycle(handler: EventHandler): Promise<void> {
  if (running || stopping) return;

  running = true;

  try {
    const events = await claimEvents();

   for (const event of events) {
         await processEvent(event, handler);
    }
  } catch (error) {
    console.error("[LearningPathOutbox] Erreur du worker:", error);
  } finally {
    running = false;
  }
}

/**
 * Démarre le worker avec un traitement immédiat,
 * puis un cycle périodique.
 */
export function startLearningPathOutboxWorker(
  handler: EventHandler,
): void {
  if (timer || stopping) return;

  console.log(`[LearningPathOutbox] Worker démarré: ${workerId}`);

  const execute = (): void => {
    if (currentRun) return;

    currentRun = runCycle(handler).finally(() => {
      currentRun = null;
    });
  };

  execute();

  timer = setInterval(execute, POLLING_INTERVAL_MS);
  timer.unref();
}

/**
 * Arrête le worker proprement et attend le cycle en cours.
 */
export async function stopLearningPathOutboxWorker(): Promise<void> {
  stopping = true;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (currentRun) {
    await currentRun;
  }

  console.log("[LearningPathOutbox] Worker arrêté.");
}
