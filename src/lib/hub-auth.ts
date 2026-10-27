import type { Session } from "next-auth";
import { headers } from "next/headers";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
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
  ensureLocalUser(identity: VerifiedCentralIdentity): Promise<LocalUser>;
  findMemberships(userId: string): Promise<LocalMembership[]>;
};

const localUserSelect = {
  id: true,
  centralPersonId: true,
  profile: { select: { fullName: true } },
} as const;

const defaultDependencies: HubAuthDependencies = {
  identityFromCookie: (cookieHeader) => hubSession().fromCookieHeader(cookieHeader),
  lookupEntitlement: lookupCentralEntitlement,
  async ensureLocalUser(identity) {
    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.user.findUnique({
      where: { centralPersonId: identity.sub },
      select: localUserSelect,
    });
    if (existing) return existing;

    const normalizedEmail = identity.email.trim().toLowerCase();
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${identity.sub}))`;

      const byPersonId = await tx.user.findUnique({
        where: { centralPersonId: identity.sub },
        select: localUserSelect,
      });
      if (byPersonId) return byPersonId;

      const emailMatches = await tx.user.findMany({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
        select: localUserSelect,
        take: 2,
      });
      if (emailMatches.length > 1) {
        throw new Error("More than one ProofPoint account matches the Hub email");
      }

      const byEmail = emailMatches[0];
      if (byEmail?.centralPersonId && byEmail.centralPersonId !== identity.sub) {
        throw new Error("The ProofPoint email is linked to another Central person");
      }
      if (byEmail) {
        return tx.user.update({
          where: { id: byEmail.id },
          data: {
            centralPersonId: identity.sub,
            email: normalizedEmail,
            emailVerified: true,
            profile: {
              upsert: {
                create: { email: normalizedEmail },
                update: { email: normalizedEmail },
              },
            },
          },
          select: localUserSelect,
        });
      }

      const passwordHash = await bcrypt.hash(randomUUID(), 12);
      return tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          emailVerified: true,
          centralPersonId: identity.sub,
          profile: { create: { email: normalizedEmail } },
        },
        select: localUserSelect,
      });
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

  const localUser = await dependencies.ensureLocalUser(identity);
  let memberships: LocalMembership[] = [];
  const needsDepartmentScope = authorizedRoles.some((role) => !GLOBAL_ROLES.has(role));

  if (needsDepartmentScope) {
    memberships = await dependencies.findMemberships(localUser.id);
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
      id: localUser.id,
      email: identity.email,
      name: localUser.profile?.fullName ?? null,
      roles,
      departmentId: departmentIds.length === 1 ? departmentIds[0] : null,
      departmentIds,
      localUserId: localUser.id,
      centralPersonId: identity.sub,
      centralRole: entitlement.role,
      permissions: entitlement.permissions,
      entitlementVersion: entitlement.version,
    },
    expires: new Date(identity.exp * 1000).toISOString(),
  };
}
