import { queryOne } from "@/lib/db";

export type RubricActor = {
  id: string;
  roles?: string[];
  departmentIds?: string[];
};

const authorRoles = new Set(["manager", "director"]);

export function canCreateRubric(actor: RubricActor): boolean {
  return actor.roles?.some((role) => role === "admin" || authorRoles.has(role)) === true;
}

export function canWriteRubricScope(
  actor: RubricActor,
  departmentId: string | null,
  isGlobal: boolean,
): boolean {
  if (actor.roles?.some((role) => role === "admin" || role === "director")) {
    return true;
  }
  return actor.roles?.includes("manager") === true &&
    !isGlobal &&
    departmentId !== null &&
    actor.departmentIds?.includes(departmentId) === true;
}

export function canManageRubric(
  actor: RubricActor,
  rubricCreatorId: string | null,
): boolean {
  if (actor.roles?.includes("admin")) return true;
  return rubricCreatorId !== null && actor.id === rubricCreatorId &&
    actor.roles?.some((role) => authorRoles.has(role)) === true;
}

export function canDeleteRubric(
  actor: RubricActor,
  rubricCreatorId: string | null,
) {
  return canManageRubric(actor, rubricCreatorId);
}

export type RubricResourceKind =
  | "template"
  | "domain"
  | "standard"
  | "kpi"
  | "section"
  | "indicator";

const ownerQueries: Record<RubricResourceKind, string> = {
  template: `SELECT rt.created_by AS "creatorId"
               FROM rubric_templates rt
              WHERE rt.id = $1 AND rt.is_active = true`,
  domain: `SELECT rt.created_by AS "creatorId"
             FROM kpi_domains resource
             JOIN rubric_templates rt ON rt.id = resource.template_id
            WHERE resource.id = $1 AND rt.is_active = true`,
  standard: `SELECT rt.created_by AS "creatorId"
               FROM kpi_standards resource
               JOIN rubric_templates rt ON rt.id = resource.template_id
              WHERE resource.id = $1 AND rt.is_active = true`,
  kpi: `SELECT rt.created_by AS "creatorId"
          FROM kpis resource
          JOIN rubric_templates rt ON rt.id = resource.template_id
         WHERE resource.id = $1 AND rt.is_active = true`,
  section: `SELECT rt.created_by AS "creatorId"
              FROM rubric_sections resource
              JOIN rubric_templates rt ON rt.id = resource.template_id
             WHERE resource.id = $1 AND rt.is_active = true`,
  indicator: `SELECT rt.created_by AS "creatorId"
                FROM rubric_indicators resource
                JOIN rubric_sections section ON section.id = resource.section_id
                JOIN rubric_templates rt ON rt.id = section.template_id
               WHERE resource.id = $1 AND rt.is_active = true`,
};

export async function rubricMutationAccess(
  actor: RubricActor,
  resource: RubricResourceKind,
  resourceId: string,
): Promise<"allowed" | "forbidden" | "not_found"> {
  const owner = await queryOne<{ creatorId: string | null }>(
    ownerQueries[resource],
    [resourceId],
  );
  if (!owner) return "not_found";
  return canManageRubric(actor, owner.creatorId) ? "allowed" : "forbidden";
}
