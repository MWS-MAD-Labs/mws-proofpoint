import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { canReadStrategicPlan, getPlanAccessRow } from "@/lib/strategic-plans";
import { sessionUser, type RouteParams } from "@/lib/strategic-api";

export async function GET(
  request: Request,
  { params }: RouteParams<{ planId: string }>,
) {
  try {
    const session = await auth();
    const user = sessionUser(session);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId } = await params;
    const plan = await getPlanAccessRow(planId);
    if (!plan)
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    if (!(await canReadStrategicPlan(plan, user)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = `%${(searchParams.get("search") ?? "").trim().toLowerCase()}%`;

    const rows = await query(
      `SELECT
         k.id,
         k.name,
         k.description,
         kd.code || '.' || ks.code || '.' || k.code AS code,
         kd.name AS domain_name,
         ks.name AS standard_name,
         rt.name AS template_name,
         rt.department_id,
         d.name AS department_name
       FROM kpis k
       JOIN kpi_standards ks ON ks.id = k.standard_id
       JOIN kpi_domains kd ON kd.id = ks.domain_id
       JOIN rubric_templates rt ON rt.id = kd.template_id
       LEFT JOIN departments d ON d.id = rt.department_id
       WHERE (
           rt.department_id = $1
           OR rt.department_id = $3
           OR rt.is_global = true
           OR EXISTS (
             SELECT 1
             FROM department_roles dr
             WHERE (dr.department_id = $1 OR dr.department_id = $3)
               AND dr.default_template_id = rt.id
           )
         )
         AND (
           $2 = '%%'
           OR LOWER(k.name) LIKE $2
           OR LOWER(COALESCE(k.description, '')) LIKE $2
           OR LOWER(kd.code || '.' || ks.code || '.' || k.code) LIKE $2
           OR LOWER(kd.name) LIKE $2
           OR LOWER(ks.name) LIKE $2
         )
       ORDER BY rt.is_global ASC, rt.name, kd.sort_order, ks.sort_order, k.sort_order
       LIMIT 100`,
      [plan.department_id, search, user.departmentId ?? plan.department_id],
    );

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("Strategic KPI picker error:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategic KPI options" },
      { status: 500 },
    );
  }
}
