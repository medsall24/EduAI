/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,id]` on the table `Formation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Module_tenantId_formationId_id_key" ON "Module"("tenantId", "formationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Module_tenantId_formationId_position_key" ON "Module"("tenantId", "formationId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Formation_tenantId_id_key" ON "Formation"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_tenantId_formationId_fkey" FOREIGN KEY ("tenantId", "formationId") REFERENCES "Formation"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
