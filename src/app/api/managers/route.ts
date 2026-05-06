// src/app/api/managers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

export async function GET() {
  // ✅ FIX: 'user' tidak dipakai — ganti dengan _user atau destructure hanya response
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const managers = await prisma.user.findMany({
      where: {
        status: "active",
        roles: {
          some: {
            role: { in: ["manager", "admin"] },
          },
        },
      },
      select: {
        id:      true,
        email:   true,
        profile: { select: { fullName: true } },
      },
      orderBy: { email: "asc" },
    });

    return NextResponse.json(managers);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/managers error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}