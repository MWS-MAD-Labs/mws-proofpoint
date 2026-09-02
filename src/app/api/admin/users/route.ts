// src/app/api/admin/users/route.ts

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import type { Prisma } from "@prisma/client";
import {
  buildUserProfileUpdate,
  normalizeUserIds,
  validateBulkReactivationStatus,
  validateUserActionTargets,
} from "./user-updates";

interface SessionUserWithRoles {
  roles?: string[];
}

type UserWithProfileAndRoles = Prisma.UserGetPayload<{
  include: {
    profile: { include: { department: true } };
    roles: true;
  };
}>;

// Helper: cek admin
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  const roles = (session.user as SessionUserWithRoles).roles ?? [];
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
    const { id, userIds, full_name, niy, job_title, department_id, roles, password, status } = body;
    const bulkUserIds = normalizeUserIds(userIds);

    if (bulkUserIds.length > 0) {
      const statusError = validateBulkReactivationStatus(status);
      if (statusError)
        return NextResponse.json({ error: statusError.error }, { status: statusError.status });

      const existingUsers = await prisma.user.findMany({
        where: { id: { in: bulkUserIds }, status: { not: "deleted" } },
        select: { id: true },
      });
      const targetError = validateUserActionTargets(
        bulkUserIds,
        existingUsers.map((user) => user.id),
      );
      if (targetError)
        return NextResponse.json({ error: targetError.error }, { status: targetError.status });

      const result = await prisma.user.updateMany({
        where: { id: { in: bulkUserIds }, status: "suspended" },
        data: { status: "active" },
      });
      return NextResponse.json({
        message: `${result.count} user${result.count === 1 ? "" : "s"} reactivated`,
        count: result.count,
      });
    }

    if (!id)
      return NextResponse.json({ error: "User ID required" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.profile.updateMany({
        where: { userId: id },
        data: buildUserProfileUpdate({ full_name, niy, job_title, department_id }),
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
    const userId = searchParams.get("userId");
    const permanent = searchParams.get("permanent") === "true";
    const body = await request.json().catch(() => null) as { userIds?: unknown; permanent?: unknown } | null;
    const userIds = userId ? [userId] : normalizeUserIds(body?.userIds);
    const shouldDeletePermanently = body?.permanent === true || permanent;
    const requestError = validateUserActionTargets(userIds, userIds, {
      currentUserId: adminCheck.session.user.id,
      preventSelfAction: true,
    });
    if (requestError)
      return NextResponse.json({ error: requestError.error }, { status: requestError.status });

    const existingUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, status: { not: "deleted" } },
      select: { id: true },
    });
    const existingUserIds = existingUsers.map((user) => user.id);

    const targetError = validateUserActionTargets(userIds, existingUserIds);
    if (targetError)
      return NextResponse.json({ error: targetError.error }, { status: targetError.status });

    if (shouldDeletePermanently) {
      const passwordHash = await bcrypt.hash(randomUUID(), 10);

      await prisma.$transaction(async (tx) => {
        await tx.userRole.deleteMany({ where: { userId: { in: existingUserIds } } });
        await tx.departmentRoleMembership.deleteMany({ where: { userId: { in: existingUserIds } } });

        for (const id of existingUserIds) {
          const deletedEmail = `deleted-${id}@deleted.invalid`;
          await tx.profile.updateMany({
            where: { userId: id },
            data: {
              email: deletedEmail,
              fullName: null,
              niy: null,
              jobTitle: null,
              departmentId: null,
              avatarUrl: null,
            },
          });
          await tx.user.update({
            where: { id },
            data: {
              email: deletedEmail,
              passwordHash,
              status: "deleted",
              emailVerified: false,
            },
          });
        }
      });

      return NextResponse.json({
        message: existingUserIds.length === 1 ? "User permanently deleted" : `${existingUserIds.length} users permanently deleted`,
        count: existingUserIds.length,
      });
    }

    await prisma.user.updateMany({
      where: { id: { in: existingUserIds } },
      data: { status: "suspended" },
    });
    return NextResponse.json({
      message: existingUserIds.length === 1 ? "User suspended" : `${existingUserIds.length} users suspended`,
      count: existingUserIds.length,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to update the selected accounts" }, { status: 500 });
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

function formatUser(user: UserWithProfileAndRoles) {
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
    roles:           user.roles?.map((role) => role.role) ?? [],
  };
}