/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FormationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "formateurId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "status" "FormationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "Category"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_slug_key" ON "Category"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_id_key" ON "Category"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Formation_tenantId_categoryId_id_key" ON "Formation"("tenantId", "categoryId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Formation_tenantId_slug_key" ON "Formation"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_id_key" ON "User"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "Category"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_tenantId_formateurId_fkey" FOREIGN KEY ("tenantId", "formateurId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

