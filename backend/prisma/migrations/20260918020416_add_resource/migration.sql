/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,id]` on the table `Lesson` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PDF', 'DOCUMENT', 'IMAGE', 'VIDEO', 'LINK', 'OTHER');

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ResourceType" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "position" INTEGER NOT NULL,
    "isDownloadable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Resource_tenantId_lessonId_id_key" ON "Resource"("tenantId", "lessonId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_tenantId_lessonId_position_key" ON "Resource"("tenantId", "lessonId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_tenantId_id_key" ON "Lesson"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_tenantId_lessonId_fkey" FOREIGN KEY ("tenantId", "lessonId") REFERENCES "Lesson"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
