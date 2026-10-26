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
    findUserByCentralPersonId: async () => null,
    findUsersByEmail: async () => [],
    findMemberships: async () => [],
    ...overrides,
  };
}

describe("resolveHubSession", () => {
  it("authenticates a Central-authorized global role without a local ProofPoint account", async () => {
    let localLookupAttempted = false;
    const session = await resolveHubSession("hub_at=test", dependencies({
      findUserByCentralPersonId: async () => {
        localLookupAttempted = true;
        return null;
      },
    }));

    assert.ok(session);
    assert.equal(session.user.id, identity.sub);
    assert.equal(session.user.centralPersonId, identity.sub);
    assert.equal(session.user.localUserId, undefined);
    assert.deepEqual(session.user.roles, ["admin"]);
    assert.equal(localLookupAttempted, true);
  });

  it("does not make the optional local database a prerequisite for a global role", async () => {
    const originalError = console.error;
    console.error = () => undefined;
    try {
      const session = await resolveHubSession("hub_at=test", dependencies({
        findUserByCentralPersonId: async () => {
          throw new Error("ProofPoint database unavailable");
        },
      }));

      assert.ok(session);
      assert.equal(session.user.id, identity.sub);
      assert.deepEqual(session.user.roles, ["admin"]);
    } finally {
      console.error = originalError;
    }
  });

  it("authenticates a Central-authorized departmental user without granting unscoped local access", async () => {
    const session = await resolveHubSession("hub_at=test", dependencies({
      lookupEntitlement: async () => entitlement("MANAGER"),
    }));

    assert.ok(session);
    assert.equal(session.user.id, identity.sub);
    assert.equal(session.user.centralRole, "MANAGER");
    assert.deepEqual(session.user.roles, []);
    assert.deepEqual(session.user.departmentIds, []);
  });

  it("applies an existing local department membership without making it the identity source", async () => {
    const localUser = {
      id: "ee0c38f1-d0ed-43e9-90a1-226391895db3",
      centralPersonId: identity.sub,
      profile: { fullName: "Local Display Name" },
    };
    const session = await resolveHubSession("hub_at=test", dependencies({
      lookupEntitlement: async () => entitlement("MANAGER"),
      findUserByCentralPersonId: async () => localUser,
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
      findUserByCentralPersonId: async () => {
        localLookupAttempted = true;
        return null;
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
        findUserByCentralPersonId: async () => {
          throw new Error("ProofPoint database unavailable");
        },
      })),
      /ProofPoint database unavailable/,
    );
  });
});
