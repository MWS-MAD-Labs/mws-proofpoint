-- AlterTable
ALTER TABLE "Observation" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "directorId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
