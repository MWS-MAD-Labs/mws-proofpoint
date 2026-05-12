-- Migration: Add flexible answer value fields to observation_answers
-- Supports SCALE (score), TEXT (text_value), CHOICE (selected_option)

ALTER TABLE "observation_answers"
  ADD COLUMN "text_value"       TEXT,
  ADD COLUMN "selected_option"  TEXT,
  ADD COLUMN "selected_options" JSONB;

-- score and note remain for SCALE type (backward compatible)
-- text_value for TEXT type
-- selected_option for CHOICE (single)
-- selected_options for CHOICE (multiple, future use)