-- Migration: Add question_type to rubric_indicators

CREATE TYPE "IndicatorQuestionType" AS ENUM (
  'SCALE',
  'CHOICE',
  'TEXT'
);

ALTER TABLE "rubric_indicators"
  ADD COLUMN "question_type" "IndicatorQuestionType" NOT NULL DEFAULT 'SCALE';

ALTER TABLE "rubric_indicators"
  ADD COLUMN "score_min"   INTEGER,
  ADD COLUMN "score_max"   INTEGER,
  ADD COLUMN "score_step"  INTEGER;

ALTER TABLE "rubric_indicators"
  ADD COLUMN "placeholder_text" TEXT;