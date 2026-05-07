/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `submittedAt` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `templateId` on the `Observation` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Observation` table. All the data in the column will be lost.
  - Added the required column `rubricId` to the `Observation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ObservationType" AS ENUM ('SELF', 'MANAGER');

-- DropForeignKey
ALTER TABLE "Observation" DROP CONSTRAINT "Observation_templateId_fkey";

-- AlterTable
ALTER TABLE "Observation" DROP COLUMN "createdAt",
DROP COLUMN "submittedAt",
DROP COLUMN "templateId",
DROP COLUMN "updatedAt",
ADD COLUMN     "acknowledgedBy" TEXT,
ADD COLUMN     "rubricId" TEXT NOT NULL,
ADD COLUMN     "type" "ObservationType" NOT NULL DEFAULT 'MANAGER';

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "rubric_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
