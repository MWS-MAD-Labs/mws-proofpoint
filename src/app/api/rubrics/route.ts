import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

// GET /api/rubrics - List rubric templates with domains, standards, and KPIs
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const templateId   = searchParams.get("id");
    const templateType = searchParams.get("templateType");

    if (templateId) {
      // Get single template
      const template = await queryOne(
        `SELECT rt.*, rt.template_type as "templateType"
         FROM rubric_templates rt
         WHERE rt.id = $1`,
        [templateId],
      );

      if (!template) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 },
        );
      }

      // Fetch domains with standards and KPIs (new structure)
      const domains = await query(
        `SELECT * FROM kpi_domains WHERE template_id = $1 ORDER BY sort_order`,
        [templateId],
      );

      const domainsWithStandards = await Promise.all(
        (domains as { id: string }[]).map(async (domain) => {
          const standards = await query(
            `SELECT * FROM kpi_standards WHERE domain_id = $1 ORDER BY sort_order`,
            [domain.id],
          );

          const standardsWithKPIs = await Promise.all(
            (standards as { id: string }[]).map(async (standard) => {
              const kpis = await query(
                `SELECT * FROM kpis WHERE standard_id = $1 ORDER BY sort_order`,
                [standard.id],
              );
              return { ...standard, kpis };
            }),
          );

          return { ...domain, standards: standardsWithKPIs };
        }),
      );

      // Also fetch legacy sections for backwards compatibility
      const sections = await query(
        `SELECT * FROM rubric_sections WHERE template_id = $1 ORDER BY sort_order`,
        [templateId],
      );

      const sectionsWithIndicators = await Promise.all(
        (sections as { id: string }[]).map(async (section) => {
          const indicators = await query(
            `SELECT * FROM rubric_indicators WHERE section_id = $1 ORDER BY sort_order`,
            [section.id],
          );
          return { ...section, indicators };
        }),
      );

      return NextResponse.json({
        data: {
          ...template,
          domains: domainsWithStandards,
          sections: sectionsWithIndicators, // Legacy support
        },
      });
    }

    // List templates with filtering
    // ?templateType=CLASSROOM_OBSERVATION  → only observation forms
    // ?templateType=KPI_APPRAISAL          → only KPI templates
    // ?templateType=all                    → all templates
    // default (no param)                  → exclude CLASSROOM_OBSERVATION (for appraisal lists)
    let whereClause = "";
    let queryParams: string[] = [];

    if (templateType === "all") {
      // no filter
    } else if (templateType === "CLASSROOM_OBSERVATION") {
      whereClause = `WHERE rt.template_type = $1`;
      queryParams = ["CLASSROOM_OBSERVATION"];
    } else if (templateType === "KPI_APPRAISAL") {
      whereClause = `WHERE rt.template_type = $1`;
      queryParams = ["KPI_APPRAISAL"];
    } else if (templateType === "GENERIC") {
      whereClause = `WHERE rt.template_type = $1`;
      queryParams = ["GENERIC"];
    } else {
      // Default: exclude CLASSROOM_OBSERVATION from appraisal rubric lists
      whereClause = `WHERE rt.template_type != $1`;
      queryParams = ["CLASSROOM_OBSERVATION"];
    }

    const templates = await query(
      `SELECT rt.*, rt.template_type as "templateType", d.name as department_name, p.full_name as created_by_name
       FROM rubric_templates rt
       LEFT JOIN departments d ON rt.department_id = d.id
       LEFT JOIN profiles p ON rt.created_by = p.user_id
       ${whereClause}
       ORDER BY rt.name`,
      queryParams,
    );

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error("Rubrics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rubrics" },
      { status: 500 },
    );
  }
}

// POST /api/rubrics - Create new rubric template
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, department_id, is_global, template_type } = body;
    const validTemplateTypes = [
      "KPI_APPRAISAL",
      "CLASSROOM_OBSERVATION",
      "GENERIC",
    ];
    const finalTemplateType = validTemplateTypes.includes(template_type)
      ? template_type
      : "KPI_APPRAISAL";

    const newTemplate = await queryOne(
      `INSERT INTO rubric_templates (name, description, department_id, is_global, created_by, template_type)
       VALUES ($1, $2, $3, $4, $5, $6::"TemplateType")
       RETURNING *`,
      [
        name,
        description ?? null,
        department_id ?? null,
        is_global ?? false,
        session.user.id,
        finalTemplateType,
      ],
    );

    return NextResponse.json({ data: newTemplate }, { status: 201 });
  } catch (error) {
    console.error("Create rubric error:", error);
    return NextResponse.json(
      { error: "Failed to create rubric" },
      { status: 500 },
    );
  }
}

// PATCH /api/rubrics - Update rubric template
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, department_id, is_global, template_type } =
      body;
    const validTemplateTypes = [
      "KPI_APPRAISAL",
      "CLASSROOM_OBSERVATION",
      "GENERIC",
    ];
    const finalTemplateType = validTemplateTypes.includes(template_type)
      ? template_type
      : undefined;

    if (!id) {
      return NextResponse.json(
        { error: "Rubric ID is required" },
        { status: 400 },
      );
    }

    const updatedTemplate = await queryOne(
      `UPDATE rubric_templates
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 department_id = $3,
                 is_global = COALESCE($4, is_global),
                 template_type = COALESCE($5::"TemplateType", template_type),
                 updated_at = now()
             WHERE id = $6
             RETURNING *`,
      [
        name,
        description,
        department_id ?? null,
        is_global,
        finalTemplateType ?? null,
        id,
      ],
    );

    if (!updatedTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: updatedTemplate });
  } catch (error) {
    console.error("Update rubric error:", error);
    return NextResponse.json(
      { error: "Failed to update rubric" },
      { status: 500 },
    );
  }
}

// DELETE /api/rubrics - Delete rubric template
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Rubric ID is required" },
        { status: 400 },
      );
    }

    await query(`DELETE FROM rubric_templates WHERE id = $1`, [id]);

    return NextResponse.json({ message: "Rubric deleted successfully" });
  } catch (error) {
    console.error("Delete rubric error:", error);
    return NextResponse.json(
      { error: "Failed to delete rubric" },
      { status: 500 },
    );
  }
}