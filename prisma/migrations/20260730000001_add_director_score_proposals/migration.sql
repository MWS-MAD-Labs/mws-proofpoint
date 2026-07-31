ALTER TABLE "assessments"
  ADD COLUMN "director_scores" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "director_evidence" JSONB NOT NULL DEFAULT '{}';
