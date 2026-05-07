-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationAnswer" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationAnswer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "rubric_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationAnswer" ADD CONSTRAINT "ObservationAnswer_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationAnswer" ADD CONSTRAINT "ObservationAnswer_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "rubric_indicators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
