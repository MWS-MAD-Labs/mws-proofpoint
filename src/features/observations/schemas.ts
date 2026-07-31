import { z } from "zod";
import {
  LEGACY_OBSERVATION_STATUSES,
  OBSERVATION_QUESTION_TYPES,
  OBSERVATION_STATUSES,
} from "./types";

export const observationStatusSchema = z.enum(OBSERVATION_STATUSES);
export const observationStatusInputSchema = z.enum([
  ...OBSERVATION_STATUSES,
  ...LEGACY_OBSERVATION_STATUSES,
]);
export const observationQuestionTypeSchema = z.enum(
  OBSERVATION_QUESTION_TYPES,
);

export const observationAnswerValueSchema = z.object({
  score: z.number().min(1).max(4).multipleOf(0.1).nullable().optional(),
  textValue: z.string().nullable().optional(),
  selectedOption: z.string().nullable().optional(),
});

export const scaleAnswerSchema = z.object({
  type: z.literal("SCALE"),
  score: z.number().min(1).max(4).multipleOf(0.1),
  note: z.string().optional(),
});

export const textAnswerSchema = z.object({
  type: z.literal("TEXT"),
  textValue: z.string().trim().min(1),
});

export const choiceAnswerSchema = z.object({
  type: z.literal("CHOICE"),
  selectedOption: z.string().trim().min(1),
});

export const observationAnswerInputSchema = z.discriminatedUnion("type", [
  scaleAnswerSchema,
  textAnswerSchema,
  choiceAnswerSchema,
]);

export const observationReopenSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Reopen reason must be at least 10 characters.")
    .max(500, "Reopen reason must be 500 characters or fewer."),
});

export type ObservationReopenInput = z.infer<typeof observationReopenSchema>;

export const observationListQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: observationStatusSchema.optional().catch(undefined),
  staffId: z.string().trim().min(1).optional().catch(undefined),
  managerId: z.string().trim().min(1).optional().catch(undefined),
  departmentId: z.string().trim().min(1).optional().catch(undefined),
  rubricId: z.string().trim().min(1).optional().catch(undefined),
  actionRequired: z.enum(["true", "false"]).optional().catch(undefined),
  overdue: z.enum(["true", "false"]).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  sort: z
    .enum([
      "updated_desc",
      "updated_asc",
      "created_desc",
      "created_asc",
      "due_asc",
      "due_desc",
    ])
    .catch("updated_desc"),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().refine((value) => [10, 20, 50].includes(value)).catch(20),
});

export type ObservationListQuery = z.infer<typeof observationListQuerySchema>;

export function parseObservationListQuery(
  searchParams: URLSearchParams,
): ObservationListQuery {
  return observationListQuerySchema.parse(
    Object.fromEntries(searchParams.entries()),
  );
}
