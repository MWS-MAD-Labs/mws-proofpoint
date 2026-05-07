/*
  Warnings:

  - You are about to drop the `Observation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ObservationAnswer` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'observation_created';
ALTER TYPE "NotificationType" ADD VALUE 'observation_pending';
ALTER TYPE "NotificationType" ADD VALUE 'observation_submitted';
ALTER TYPE "NotificationType" ADD VALUE 'observation_acknowledged';

-- AlterEnum
ALTER TYPE "ObservationStatus" ADD VALUE 'pending';

-- DropForeignKey
ALTER TABLE "Observation" DROP CONSTRAINT "Observation_director_id_fkey";

-- DropForeignKey
ALTER TABLE "Observation" DROP CONSTRAINT "Observation_managerId_fkey";

-- DropForeignKey
ALTER TABLE "Observation" DROP CONSTRAINT "Observation_rubricId_fkey";

-- DropForeignKey
ALTER TABLE "Observation" DROP CONSTRAINT "Observation_staffId_fkey";

-- DropForeignKey
ALTER TABLE "ObservationAnswer" DROP CONSTRAINT "ObservationAnswer_indicatorId_fkey";

-- DropForeignKey
ALTER TABLE "ObservationAnswer" DROP CONSTRAINT "ObservationAnswer_observationId_fkey";

-- DropTable
DROP TABLE "Observation";

-- DropTable
DROP TABLE "ObservationAnswer";

-- CreateTable
CREATE TABLE "observations" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "managerId" TEXT,
    "director_id" TEXT,
    "rubricId" TEXT NOT NULL,
    "status" "ObservationStatus" NOT NULL DEFAULT 'draft',
    "type" "ObservationType" NOT NULL DEFAULT 'MANAGER',
    "title" TEXT,
    "description" TEXT,
    "submitted_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_updates" (
    "id" TEXT NOT NULL,
    "observation_id" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "statusFrom" "ObservationStatus" NOT NULL,
    "statusTo" "ObservationStatus" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observation_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observation_answers" (
    "id" TEXT NOT NULL,
    "observation_id" TEXT NOT NULL,
    "indicator_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" VARCHAR(1000),
    "evidence" TEXT,
    "evidence_file" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observation_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "observations_staffId_idx" ON "observations"("staffId");

-- CreateIndex
CREATE INDEX "observations_managerId_idx" ON "observations"("managerId");

-- CreateIndex
CREATE INDEX "observations_status_idx" ON "observations"("status");

-- CreateIndex
CREATE INDEX "observations_created_at_idx" ON "observations"("created_at");

-- CreateIndex
CREATE INDEX "observation_updates_observation_id_idx" ON "observation_updates"("observation_id");

-- CreateIndex
CREATE INDEX "observation_updates_updated_by_idx" ON "observation_updates"("updated_by");

-- CreateIndex
CREATE INDEX "observation_answers_observation_id_idx" ON "observation_answers"("observation_id");

-- CreateIndex
CREATE INDEX "observation_answers_indicator_id_idx" ON "observation_answers"("indicator_id");

-- CreateIndex
CREATE UNIQUE INDEX "observation_answers_observation_id_indicator_id_key" ON "observation_answers"("observation_id", "indicator_id");

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "rubric_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_updates" ADD CONSTRAINT "observation_updates_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_updates" ADD CONSTRAINT "observation_updates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_answers" ADD CONSTRAINT "observation_answers_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observation_answers" ADD CONSTRAINT "observation_answers_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "rubric_indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
