import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CentralEntitlement } from "@/lib/central-access";
import { resolveHubSession, type HubAuthDependencies } from "@/lib/hub-auth";

const identity = {
  sub: "1db43b65-63ce-46bf-b6e6-1dcfbc6fbc85",
  email: "central.user@example.test",
  source: "employee" as const,
  exp: 1_900_000_000,
};

const localUser = {
  id: "ee0c38f1-d0ed-43e9-90a1-226391895db3",
  centralPersonId: identity.sub,
  profile: { fullName: "Local Display Name" },
};

function entitlement(role: string): CentralEntitlement {
  return {
    id: "group:proofpoint-employees",
    application_id: "proofpoint",
    organization_id: "organization-1",
    role,
    permissions: ["proofpoint.access", `proofpoint.${role.toLowerCase()}`],
    version: 1,
    is_active: true,
  };
}

function dependencies(
  overrides: Partial<HubAuthDependencies> = {},
): HubAuthDependencies {
  return {
    identityFromCookie: async () => identity,
    lookupEntitlement: async () => entitlement("ADMIN"),
    ensureLocalUser: async () => localUser,
    findMemberships: async () => [],
    ...overrides,
  };
}

describe("resolveHubSession", () => {
  it("projects a Central-authorized global role into a local ProofPoint account", async () => {
    let projectionAttempted = false;
    const session = await resolveHubSession("hub_at=test", dependencies({
      ensureLocalUser: async () => {
        projectionAttempted = true;
        return localUser;
      },
    }));

    assert.ok(session);
    assert.equal(session.user.id, localUser.id);
    assert.equal(session.user.centralPersonId, identity.sub);
    assert.equal(session.user.localUserId, localUser.id);
    assert.deepEqual(session.user.roles, ["admin"]);
    assert.equal(projectionAttempted, true);
  });

  it("fails closed when the local account cannot be projected", async () => {
    await assert.rejects(
      resolveHubSession("hub_at=test", dependencies({
        ensureLocalUser: async () => {
          throw new Error("ProofPoint database unavailable");
        },
      })),
      /ProofPoint database unavailable/,
    );
  });

  it("authenticates a Central-authorized departmental user without granting unscoped local access", async () => {
    const session = await resolveHubSession("hub_at=test", dependencies({
      lookupEntitlement: async () => entitlement("MANAGER"),
    }));

    assert.ok(session);
    assert.equal(session.user.id, localUser.id);
    assert.equal(session.user.centralRole, "MANAGER");
    assert.deepEqual(session.user.roles, []);
    assert.deepEqual(session.user.departmentIds, []);
  });

  it("applies an existing local department membership without making it the identity source", async () => {
    const session = await resolveHubSession("hub_at=test", dependencies({
      lookupEntitlement: async () => entitlement("MANAGER"),
      findMemberships: async () => [{
        departmentRole: {
          role: "manager",
          departmentId: "6aee25d6-74f6-4863-b815-4a93df30c2fa",
        },
      }],
    }));

    assert.ok(session);
    assert.equal(session.user.id, localUser.id);
    assert.equal(session.user.localUserId, localUser.id);
    assert.equal(session.user.centralPersonId, identity.sub);
    assert.deepEqual(session.user.roles, ["manager"]);
    assert.deepEqual(session.user.departmentIds, ["6aee25d6-74f6-4863-b815-4a93df30c2fa"]);
  });

  it("denies the session when Central grants no application access", async () => {
    let localLookupAttempted = false;
    const session = await resolveHubSession("hub_at=test", dependencies({
      lookupEntitlement: async () => null,
      ensureLocalUser: async () => {
        localLookupAttempted = true;
        return localUser;
      },
    }));

    assert.equal(session, null);
    assert.equal(localLookupAttempted, false);
  });

  it("fails closed when Central access lookup fails", async () => {
    await assert.rejects(
      resolveHubSession("hub_at=test", dependencies({
        lookupEntitlement: async () => {
          throw new Error("Central unavailable");
        },
      })),
      /Central unavailable/,
    );
  });

  it("fails closed when required department scope cannot be read", async () => {
    await assert.rejects(
      resolveHubSession("hub_at=test", dependencies({
        lookupEntitlement: async () => entitlement("MANAGER"),
        findMemberships: async () => {
          throw new Error("ProofPoint membership lookup unavailable");
        },
      })),
      /ProofPoint membership lookup unavailable/,
    );
  });
});
