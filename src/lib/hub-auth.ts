import type { Session } from "next-auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  lookupCentralEntitlement,
  rolesFromPermissions,
  rolesWithinLocalDepartmentScope,
} from "@/lib/central-access";
import { hubSession } from "@/lib/hub-session";

export async function resolveHubSession(cookieHeader?: string | null): Promise<Session | null> {
  const cookie = cookieHeader === undefined
    ? (await headers()).get("cookie")
    : cookieHeader;
  const claims = await hubSession().fromCookieHeader(cookie);
  if (!claims || claims.source !== "employee") return null;

  const entitlement = await lookupCentralEntitlement(claims.sub);
  if (!entitlement) return null;
  const authorizedRoles = rolesFromPermissions(entitlement.permissions);

  let user = await prisma.user.findUnique({
    where: { centralPersonId: claims.sub },
    include: { profile: true },
  });
  if (!user) {
    const emailMatches = await prisma.user.findMany({
      where: { email: { equals: claims.email, mode: "insensitive" } },
      include: { profile: true },
      take: 2,
    });
    if (emailMatches.length !== 1 || emailMatches[0]?.centralPersonId) {
      if (emailMatches.length > 1) {
        console.error("[hub-auth] More than one ProofPoint account matches the Hub email");
      }
      return null;
    }
    const byEmail = emailMatches[0]!;
    const linked = await prisma.user.updateMany({
      where: { id: byEmail.id, centralPersonId: null },
      data: { centralPersonId: claims.sub },
    });
    if (linked.count !== 1) {
      user = await prisma.user.findUnique({
        where: { centralPersonId: claims.sub },
        include: { profile: true },
      });
    } else {
      user = { ...byEmail, centralPersonId: claims.sub };
    }
  }
  if (!user || user.status !== "active") return null;

  const memberships = await prisma.departmentRoleMembership.findMany({
    where: { userId: user.id },
    select: {
      departmentRole: {
        select: { role: true, departmentId: true },
      },
    },
  });
  const roles = rolesWithinLocalDepartmentScope(
    authorizedRoles,
    memberships.map(({ departmentRole }) => departmentRole.role),
  );
  if (roles.length === 0) return null;

  const departmentIds = Array.from(new Set(
    memberships
      .filter(({ departmentRole }) => roles.includes(departmentRole.role) && departmentRole.departmentId)
      .map(({ departmentRole }) => departmentRole.departmentId as string),
  ));

  return {
    user: {
      id: user.id,
      email: claims.email,
      name: user.profile?.fullName ?? null,
      roles,
      departmentId: departmentIds.length === 1 ? departmentIds[0] : null,
      departmentIds,
      centralPersonId: claims.sub,
      centralRole: entitlement.role,
      permissions: entitlement.permissions,
      entitlementVersion: entitlement.version,
    },
    expires: new Date(claims.exp * 1000).toISOString(),
  };
}
