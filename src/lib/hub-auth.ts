import type { Session } from "next-auth";
import { headers } from "next/headers";
import type { HubSessionClaims } from "mws-central-auth/server";
import {
  lookupCentralEntitlement,
  rolesFromCentralEntitlement,
  rolesWithinLocalDepartmentScope,
  type CentralEntitlement,
  type ProofPointRole,
} from "@/lib/central-access";
import { hubSession } from "@/lib/hub-session";

type VerifiedCentralIdentity = Pick<HubSessionClaims, "sub" | "email" | "source" | "exp">;

type LocalUser = {
  id: string;
  centralPersonId: string | null;
  profile: { fullName: string | null } | null;
};

type LocalMembership = {
  departmentRole: { role: string; departmentId: string | null };
};

export type HubAuthDependencies = {
  identityFromCookie(cookieHeader: string | null): Promise<VerifiedCentralIdentity | null>;
  lookupEntitlement(personId: string): Promise<CentralEntitlement | null>;
  findUserByCentralPersonId(personId: string): Promise<LocalUser | null>;
  findUsersByEmail(email: string): Promise<LocalUser[]>;
  findMemberships(userId: string): Promise<LocalMembership[]>;
};

const defaultDependencies: HubAuthDependencies = {
  identityFromCookie: (cookieHeader) => hubSession().fromCookieHeader(cookieHeader),
  lookupEntitlement: lookupCentralEntitlement,
  async findUserByCentralPersonId(personId) {
    const { prisma } = await import("@/lib/prisma");
    return prisma.user.findUnique({
      where: { centralPersonId: personId },
      select: {
        id: true,
        centralPersonId: true,
        profile: { select: { fullName: true } },
      },
    });
  },
  async findUsersByEmail(email) {
    const { prisma } = await import("@/lib/prisma");
    return prisma.user.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        centralPersonId: true,
        profile: { select: { fullName: true } },
      },
      take: 2,
    });
  },
  async findMemberships(userId) {
    const { prisma } = await import("@/lib/prisma");
    return prisma.departmentRoleMembership.findMany({
      where: { userId },
      select: {
        departmentRole: {
          select: { role: true, departmentId: true },
        },
      },
    });
  },
};

const GLOBAL_ROLES = new Set<ProofPointRole>(["admin", "director"]);

async function findOptionalLocalUser(
  identity: VerifiedCentralIdentity,
  dependencies: HubAuthDependencies,
): Promise<LocalUser | null> {
  const byPersonId = await dependencies.findUserByCentralPersonId(identity.sub);
  if (byPersonId) return byPersonId;

  const emailMatches = await dependencies.findUsersByEmail(identity.email);
  if (emailMatches.length > 1) {
    console.error("[hub-auth] More than one ProofPoint account matches the Hub email");
    return null;
  }

  const byEmail = emailMatches[0] ?? null;
  if (byEmail?.centralPersonId && byEmail.centralPersonId !== identity.sub) return null;
  return byEmail;
}

export async function resolveHubSession(
  cookieHeader?: string | null,
  dependencies: HubAuthDependencies = defaultDependencies,
): Promise<Session | null> {
  const cookie = cookieHeader === undefined
    ? (await headers()).get("cookie")
    : cookieHeader;
  const identity = await dependencies.identityFromCookie(cookie);
  if (!identity || identity.source !== "employee") return null;

  const entitlement = await dependencies.lookupEntitlement(identity.sub);
  if (!entitlement) return null;
  const authorizedRoles = rolesFromCentralEntitlement(
    entitlement.role,
    entitlement.permissions,
  );

  let localUser: LocalUser | null = null;
  let memberships: LocalMembership[] = [];
  const needsDepartmentScope = authorizedRoles.some((role) => !GLOBAL_ROLES.has(role));

  try {
    localUser = await findOptionalLocalUser(identity, dependencies);
  } catch (error) {
    if (needsDepartmentScope) throw error;
    console.error(
      "[hub-auth] Optional ProofPoint user lookup failed; continuing with the Central identity",
      error instanceof Error ? error.message : error,
    );
  }

  if (needsDepartmentScope) {
    memberships = localUser
      ? await dependencies.findMemberships(localUser.id)
      : [];
  }

  const roles = rolesWithinLocalDepartmentScope(
    authorizedRoles,
    memberships.map(({ departmentRole }) => departmentRole.role),
  );
  const departmentIds = Array.from(new Set(
    memberships
      .filter(({ departmentRole }) => roles.includes(departmentRole.role as ProofPointRole) && departmentRole.departmentId)
      .map(({ departmentRole }) => departmentRole.departmentId as string),
  ));

  return {
    user: {
      // Existing ProofPoint records keep their application-local actor ID. A
      // Central-only principal is still a valid session and uses Central's
      // stable person ID until an operation genuinely needs local app data.
      id: localUser?.id ?? identity.sub,
      email: identity.email,
      name: localUser?.profile?.fullName ?? null,
      roles,
      departmentId: departmentIds.length === 1 ? departmentIds[0] : null,
      departmentIds,
      localUserId: localUser?.id,
      centralPersonId: identity.sub,
      centralRole: entitlement.role,
      permissions: entitlement.permissions,
      entitlementVersion: entitlement.version,
    },
    expires: new Date(identity.exp * 1000).toISOString(),
  };
}
