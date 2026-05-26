// src/lib/auth-helpers.ts
// Helper wrappers for Next.js API route authentication

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type AuthResult = {
  user: { id: string; roles: string[] } | null;
  response: NextResponse | null;
};

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return {
    user: {
      id: session.user.id,
      roles: (session.user as any).roles ?? [],
    },
    response: null,
  };
}

export async function requireRole(...roles: string[]): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.response) return result;

  const hasRole = roles.some((r) => result.user!.roles.includes(r));
  if (!hasRole) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}