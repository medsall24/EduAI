-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Progress_tenantId_userId_formationId_idx" ON "Progress"("tenantId", "userId", "formationId");

-- CreateIndex
CREATE INDEX "Progress_tenantId_formationId_idx" ON "Progress"("tenantId", "formationId");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_tenantId_userId_lessonId_key" ON "Progress"("tenantId", "userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_tenantId_id_key" ON "Progress"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_tenantId_formationId_fkey" FOREIGN KEY ("tenantId", "formationId") REFERENCES "Formation"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_tenantId_lessonId_fkey" FOREIGN KEY ("tenantId", "lessonId") REFERENCES "Lesson"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
