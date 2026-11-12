
import type { Prisma } from "../../generated/prisma/client.js";
import type { LearningPathEventType } from "../../generated/prisma/enums.js";

/**
 * Enregistre un événement Outbox dans la transaction métier.
 * L'événement sera publié uniquement si la transaction est validée.
 */
export async function enqueueLearningPathEvent(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventType: LearningPathEventType;
    aggregateId: string;
    payload: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.learningPathOutbox.create({
    data: {
      tenantId: input.tenantId,
      eventType: input.eventType,
      aggregateId: input.aggregateId,
      payload: input.payload,
    },
  });
}
