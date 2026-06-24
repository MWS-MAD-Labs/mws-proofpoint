// src/app/api/admin/users/route.ts

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import type { AppRole } from "@prisma/client";

// Helper: cek admin
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  const roles = (session.user as any).roles ?? [];
  if (!roles.includes("admin")) return { error: "Forbidden", status: 403 as const };
  return { session };
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: { include: { department: true } },
          roles: true,
        },
      });
      if (!user) return NextResponse.json({ data: null });
      return NextResponse.json({ data: formatUser(user) });
    }

    const users = await prisma.user.findMany({
      where: { status: { not: "deleted" } },
      include: {
        profile: { include: { department: true } },
        roles: true,
      },
      orderBy: { profile: { fullName: "asc" } },
    });

    return NextResponse.json({ data: users.map(formatUser) });
  } catch (error) {
    console.error("Admin users GET error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// ── POST /api/admin/users ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

    const body = await request.json();
    const { email, password, full_name, niy, job_title, department_id, roles } = body;

    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 10);

    const rolesArray = sanitizeRoles(roles);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id:           randomUUID(),
          email,
          passwordHash,
          status:       "active",
        },
      });

      await tx.profile.create({
        data: {
          id:           randomUUID(),
          userId:       user.id,
          email,
          fullName:     full_name     ?? null,
          niy:          niy           ?? null,
          jobTitle:     job_title     ?? null,
          departmentId: department_id ?? null,
        },
      });

      for (const role of rolesArray) {
  await tx.$executeRawUnsafe(
    `INSERT INTO user_roles (id, user_id, role, created_at)
     VALUES ($1, $2, $3::app_role, NOW())`,
    randomUUID(), user.id, role
  );
}

      return user;
    });

    const created = await prisma.user.findUnique({
      where: { id: newUser.id },
      include: { profile: { include: { department: true } }, roles: true },
    });

    return NextResponse.json({ data: formatUser(created!) }, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

// ── PUT /api/admin/users ──────────────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

    const body = await request.json();
    const { id, full_name, niy, job_title, department_id, roles, password, status } = body;

    if (!id)
      return NextResponse.json({ error: "User ID required" }, { status: 400 });

    const finalDeptId = (department_id === "" || department_id === "none") ? null : department_id ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.profile.updateMany({
        where: { userId: id },
        data: {
          fullName:     full_name ?? undefined,
          niy:          niy       ?? undefined,
          jobTitle:     job_title ?? undefined,
          departmentId: finalDeptId,
        },
      });

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        await tx.user.update({ where: { id }, data: { passwordHash } });
      }

      if (status) {
        await tx.user.update({ where: { id }, data: { status } });
      }

      if (roles) {
        const rolesArray = sanitizeRoles(roles);
        if (rolesArray.length > 0) {
          await tx.userRole.deleteMany({ where: { userId: id } });
for (const role of rolesArray) {
  await tx.$executeRawUnsafe(
    `INSERT INTO user_roles (id, user_id, role, created_at)
     VALUES ($1, $2, $3::app_role, NOW())`,
    randomUUID(), id, role
  );
}
        }
      }
    });

    const updated = await prisma.user.findUnique({
      where: { id },
      include: { profile: { include: { department: true } }, roles: true },
    });

    return NextResponse.json({ data: formatUser(updated!) });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// ── DELETE /api/admin/users ───────────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck)
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

    const { searchParams } = new URL(request.url);
    const userId   = searchParams.get("userId");
    const permanent = searchParams.get("permanent") === "true";

    if (!userId)
      return NextResponse.json({ error: "User ID required" }, { status: 400 });

    if (userId === adminCheck.session.user.id)
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });

    if (permanent) {
      await prisma.user.delete({ where: { id: userId } });
      return NextResponse.json({ message: "User permanently deleted" });
    } else {
      await prisma.user.update({ where: { id: userId }, data: { status: "suspended" } });
      return NextResponse.json({ message: "User suspended" });
    }
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_ROLES = ["admin", "staff", "manager", "director", "supervisor"];

function sanitizeRoles(roles: unknown): string[] {
  let arr: string[] = ["staff"];
  if (Array.isArray(roles)) {
    arr = roles.map((r) => String(r).trim().toLowerCase()).filter(Boolean);
  } else if (typeof roles === "string" && roles.length > 0) {
    arr = roles.replace(/[{}]/g, "").split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
  }
  const filtered = arr.filter((r) => VALID_ROLES.includes(r));
  return filtered.length > 0 ? filtered : ["staff"];
}

function formatUser(user: any) {
  return {
    id:              user.id,
    email:           user.email,
    status:          user.status,
    created_at:      user.createdAt,
    full_name:       user.profile?.fullName     ?? null,
    niy:             user.profile?.niy          ?? null,
    job_title:       user.profile?.jobTitle     ?? null,
    department_id:   user.profile?.departmentId ?? null,
    department_name: user.profile?.department?.name ?? null,
    roles:           user.roles?.map((r: any) => r.role) ?? [],
  };
}