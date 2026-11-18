-- AddForeignKey
ALTER TABLE "AITrainerDraft" ADD CONSTRAINT "AITrainerDraft_tenantId_reviewedById_fkey" FOREIGN KEY ("tenantId", "reviewedById") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
