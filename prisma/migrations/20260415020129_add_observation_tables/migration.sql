-- AlterTable
ALTER TABLE "Observation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Observation_staffId_idx" ON "Observation"("staffId");

-- CreateIndex
CREATE INDEX "Observation_managerId_idx" ON "Observation"("managerId");

-- CreateIndex
CREATE INDEX "Observation_status_idx" ON "Observation"("status");
