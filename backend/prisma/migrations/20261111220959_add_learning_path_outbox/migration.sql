-- CreateEnum
CREATE TYPE "LearningPathEventType" AS ENUM ('ENROLLMENT_ACTIVATED', 'ENROLLMENT_CANCELLED', 'ENROLLMENT_DELETED', 'ENROLLMENT_COMPLETED', 'FORMATION_PUBLISHED', 'PROGRESS_UPDATED', 'QUIZ_SUBMITTED');

-- CreateEnum
CREATE TYPE "LearningPathOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "LearningPathOutbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" "LearningPathEventType" NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "LearningPathOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPathOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathOutbox_eventId_key" ON "LearningPathOutbox"("eventId");

-- CreateIndex
CREATE INDEX "LearningPathOutbox_tenantId_status_nextRetryAt_idx" ON "LearningPathOutbox"("tenantId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "LearningPathOutbox_status_nextRetryAt_createdAt_idx" ON "LearningPathOutbox"("status", "nextRetryAt", "createdAt");

-- CreateIndex
CREATE INDEX "LearningPathOutbox_tenantId_aggregateId_createdAt_idx" ON "LearningPathOutbox"("tenantId", "aggregateId", "createdAt");

-- AddForeignKey
ALTER TABLE "LearningPathOutbox" ADD CONSTRAINT "LearningPathOutbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
