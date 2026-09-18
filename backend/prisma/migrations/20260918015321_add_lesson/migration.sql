/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,id]` on the table `Module` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('TEXT', 'VIDEO', 'DOCUMENT', 'MIXED');

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "LessonType" NOT NULL,
    "content" TEXT,
    "videoUrl" TEXT,
    "duration" INTEGER,
    "position" INTEGER NOT NULL,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_tenantId_moduleId_id_key" ON "Lesson"("tenantId", "moduleId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_tenantId_moduleId_position_key" ON "Lesson"("tenantId", "moduleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Module_tenantId_id_key" ON "Module"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_tenantId_moduleId_fkey" FOREIGN KEY ("tenantId", "moduleId") REFERENCES "Module"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
