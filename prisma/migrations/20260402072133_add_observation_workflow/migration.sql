/*
  Warnings:

  - The `status` column on the `Observation` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Observation" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "ObservationStatus" NOT NULL DEFAULT 'draft';
