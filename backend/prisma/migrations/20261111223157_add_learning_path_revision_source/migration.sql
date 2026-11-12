/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,learningPathId,sourceAttemptId]` on the table `LearningPathStep` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "LearningPathStep" ADD COLUMN     "sourceAttemptId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathStep_tenantId_learningPathId_sourceAttemptId_key" ON "LearningPathStep"("tenantId", "learningPathId", "sourceAttemptId");
