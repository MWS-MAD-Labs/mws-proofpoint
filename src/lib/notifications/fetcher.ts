import { queryOne } from "@/lib/db";
import type { AssessmentNotificationData } from "./types";

export async function getAssessmentNotificationData(
  assessmentId: string,
): Promise<AssessmentNotificationData | null> {
  const result = await queryOne<
    AssessmentNotificationData & {
      returnedByName: string | null;
    }
  >(
    `SELECT
      a.id as "assessmentId",
      a.staff_id as "staffId",
      a.period,
      a.final_score as "score",
      a.final_grade as "grade",
      rt.name as "templateName",
      sp.full_name as "staffName",
      sp.email as "staffEmail",
      mp.full_name as "managerName",
      mp.email as "managerEmail",
      mp.user_id as "managerId",
      dp.full_name as "directorName",
      dp.email as "directorEmail",
      dp.user_id as "directorId",
      a.return_feedback as "notes",
      rp.full_name as "returnedByName"
    FROM assessments a
    LEFT JOIN rubric_templates rt ON a.template_id = rt.id
    LEFT JOIN profiles sp ON a.staff_id = sp.user_id
    LEFT JOIN profiles mp ON a.manager_id = mp.user_id
    LEFT JOIN profiles dp ON a.director_id = dp.user_id
    LEFT JOIN profiles rp ON a.returned_by = rp.user_id
    WHERE a.id = $1`,
    [assessmentId],
  );

  if (!result) return null;

  return {
    assessmentId: result.assessmentId,
    staffId: result.staffId,
    staffName: result.staffName || "Staff",
    staffEmail: result.staffEmail,
    period: result.period,
    templateName: result.templateName,
    score: result.score?.toString(),
    grade: result.grade,
    notes: result.notes,
    managerId: result.managerId,
    managerName: result.managerName,
    managerEmail: result.managerEmail,
    directorId: result.directorId,
    directorName: result.directorName,
    directorEmail: result.directorEmail,
    returnedBy: result.returnedByName || undefined,
  };
}
