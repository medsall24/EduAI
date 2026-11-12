-- CreateEnum
CREATE TYPE "LearningPathStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LearningPathStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LearningPathStepType" AS ENUM ('LESSON', 'REVISION');

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "status" "LearningPathStatus" NOT NULL DEFAULT 'ACTIVE',
    "generationVersion" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAdaptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPathStep" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "learningPathId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "stepType" "LearningPathStepType" NOT NULL DEFAULT 'LESSON',
    "recommendationReason" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" "LearningPathStepStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPathStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningPath_tenantId_userId_status_idx" ON "LearningPath"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "LearningPath_tenantId_formationId_idx" ON "LearningPath"("tenantId", "formationId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPath_tenantId_id_key" ON "LearningPath"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPath_tenantId_userId_formationId_generationVersion_key" ON "LearningPath"("tenantId", "userId", "formationId", "generationVersion");

-- CreateIndex
CREATE INDEX "LearningPathStep_tenantId_learningPathId_status_idx" ON "LearningPathStep"("tenantId", "learningPathId", "status");

-- CreateIndex
CREATE INDEX "LearningPathStep_tenantId_lessonId_idx" ON "LearningPathStep"("tenantId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathStep_tenantId_id_key" ON "LearningPathStep"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPathStep_tenantId_learningPathId_position_key" ON "LearningPathStep"("tenantId", "learningPathId", "position");

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_tenantId_formationId_fkey" FOREIGN KEY ("tenantId", "formationId") REFERENCES "Formation"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathStep" ADD CONSTRAINT "LearningPathStep_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathStep" ADD CONSTRAINT "LearningPathStep_tenantId_learningPathId_fkey" FOREIGN KEY ("tenantId", "learningPathId") REFERENCES "LearningPath"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPathStep" ADD CONSTRAINT "LearningPathStep_tenantId_lessonId_fkey" FOREIGN KEY ("tenantId", "lessonId") REFERENCES "Lesson"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
