import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { BUCKET_NAME, s3Client } from "@/lib/storage";
import { getAssessmentPermissions } from "@/features/assessments/server/permissions";

interface AssessmentEvidenceRow {
  staffId: string;
  managerId: string | null;
  directorId: string | null;
  status: string;
  workflowSnapshot: unknown;
  staffEvidence: unknown;
  managerEvidence: unknown;
}

function collectEvidenceUrls(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  return Object.values(value).flatMap((entry) => {
    if (typeof entry === "string") return entry.trim() ? [entry.trim()] : [];
    if (!Array.isArray(entry)) return [];

    return entry.flatMap((item) => {
      if (!item || typeof item !== "object" || !("evidence" in item)) return [];
      const evidence = (item as { evidence?: unknown }).evidence;
      return typeof evidence === "string" && evidence.trim() ? [evidence.trim()] : [];
    });
  });
}

function getObjectKey(value: string): string | null {
  try {
    const url = new URL(value);
    const bucketPrefix = `/${BUCKET_NAME}/`;
    const prefixIndex = url.pathname.indexOf(bucketPrefix);
    if (prefixIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(prefixIndex + bucketPrefix.length));
  } catch {
    return null;
  }
}

function sanitizeFileName(value: string) {
  return value.replace(/["\\\r\n]/g, "_");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const requestedUrl = new URL(request.url).searchParams.get("url")?.trim();
    if (!requestedUrl) return NextResponse.json({ error: "Evidence URL is required" }, { status: 400 });

    const assessment = await queryOne<AssessmentEvidenceRow>(
      `SELECT staff_id AS "staffId",
              manager_id AS "managerId",
              director_id AS "directorId",
              status,
              workflow_snapshot AS "workflowSnapshot",
              staff_evidence AS "staffEvidence",
              manager_evidence AS "managerEvidence"
       FROM assessments
       WHERE id = $1`,
      [id],
    );
    if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });

    const roles = ((session.user as { roles?: string[] }).roles ?? []) as string[];
    const permissions = getAssessmentPermissions({ id: session.user.id, roles }, assessment);
    if (!permissions.canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const referencedUrls = [...collectEvidenceUrls(assessment.staffEvidence), ...collectEvidenceUrls(assessment.managerEvidence)];
    if (!referencedUrls.includes(requestedUrl)) {
      return NextResponse.json({ error: "Evidence not found in this assessment" }, { status: 404 });
    }

    const requestedKey = getObjectKey(requestedUrl);
    if (!requestedKey) return NextResponse.json({ error: "Invalid evidence URL" }, { status: 400 });

    const object = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: requestedKey }));
    if (!object.Body) return NextResponse.json({ error: "Evidence file is unavailable" }, { status: 404 });

    const body = object.Body.transformToWebStream();
    const fileName = sanitizeFileName(requestedKey.split("/").pop()?.replace(/^\d+_/, "") || "evidence");
    return new Response(body, {
      headers: {
        "Content-Type": object.ContentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Assessment evidence download error:", error);
    return NextResponse.json({ error: "Failed to download evidence" }, { status: 500 });
  }
}
