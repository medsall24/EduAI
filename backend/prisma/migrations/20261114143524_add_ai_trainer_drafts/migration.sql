-- CreateEnum
CREATE TYPE "AITrainerDraftType" AS ENUM ('QUIZ', 'EXERCISE', 'LESSON_CONTENT');

-- CreateEnum
CREATE TYPE "AITrainerDraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "AITrainerDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formateurId" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "lessonId" TEXT,
    "type" "AITrainerDraftType" NOT NULL,
    "content" JSONB NOT NULL,
    "status" "AITrainerDraftStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AITrainerDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AITrainerDraft_tenantId_formateurId_status_createdAt_idx" ON "AITrainerDraft"("tenantId", "formateurId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AITrainerDraft_tenantId_formationId_idx" ON "AITrainerDraft"("tenantId", "formationId");

-- CreateIndex
CREATE INDEX "AITrainerDraft_tenantId_lessonId_idx" ON "AITrainerDraft"("tenantId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "AITrainerDraft_tenantId_id_key" ON "AITrainerDraft"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "AITrainerDraft" ADD CONSTRAINT "AITrainerDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITrainerDraft" ADD CONSTRAINT "AITrainerDraft_tenantId_formateurId_fkey" FOREIGN KEY ("tenantId", "formateurId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITrainerDraft" ADD CONSTRAINT "AITrainerDraft_tenantId_formationId_fkey" FOREIGN KEY ("tenantId", "formationId") REFERENCES "Formation"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITrainerDraft" ADD CONSTRAINT "AITrainerDraft_tenantId_lessonId_fkey" FOREIGN KEY ("tenantId", "lessonId") REFERENCES "Lesson"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
