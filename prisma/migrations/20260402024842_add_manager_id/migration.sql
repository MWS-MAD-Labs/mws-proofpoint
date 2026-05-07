/*
  Warnings:

  - You are about to drop the column `status` on the `Observation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[observationId,indicatorId]` on the table `ObservationAnswer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ObservationStatus" AS ENUM ('draft', 'submitted', 'reviewed', 'acknowledged');

-- AlterTable
ALTER TABLE "Observation" DROP COLUMN "status",
ADD COLUMN     "director_id" TEXT,
ADD COLUMN     "managerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ObservationAnswer_observationId_indicatorId_key" ON "ObservationAnswer"("observationId", "indicatorId");

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
