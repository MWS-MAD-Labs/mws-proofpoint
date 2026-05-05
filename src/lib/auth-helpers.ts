// src/lib/auth-helpers.ts

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

interface SessionUser {
  id: string;
  email: string;
  roles: string[];
  departmentId?: string | null;
  name?: string | null;
}

interface AuthResult {
  user: SessionUser | null;
  response: NextResponse | null;
}

/**
 * Check whether the user is logged in.
 * Returns { user, response: null } if authenticated.
 * Returns { user: null, response: 401 } if not logged in.
 */
export async function requireAuth(): Promise<AuthResult> {
  // auth() replaces getServerSession in Next Auth v5
  const session = await auth();

  if (!session?.user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized. Please log in first." },
        { status: 401 }
      ),
    };
  }

  return { user: session.user as SessionUser, response: null };
}

/**
 * Check login status and role ownership.
 *
 * Examples:
 *   requireRole("admin")             → admin only
 *   requireRole("manager", "admin")  → manager OR admin
 *   requireRole("staff", "admin")    → staff OR admin
 *
 * Admin always passes all requireRole checks automatically.
 */
export async function requireRole(...roles: string[]): Promise<AuthResult> {
  const { user, response } = await requireAuth();
  if (response) return { user: null, response };

  const userRoles: string[] = user!.roles ?? [];
  const isAdmin  = userRoles.includes("admin");
  const hasRole  = isAdmin || roles.some((r) => userRoles.includes(r));

  if (!hasRole) {
    return {
      user: null,
      response: NextResponse.json(
        { error: `Forbidden. One of the following roles is required: ${roles.join(", ")}.` },
        { status: 403 }
      ),
    };
  }

  return { user: user!, response: null };
}