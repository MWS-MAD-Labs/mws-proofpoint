import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { clearCentralEntitlementCacheForTest } from "@/lib/central-access";
import { setObservationTestActor } from "@/features/observations/server/auth";
import { PATCH } from "@/app/api/observations/[id]/route";

test("admin metadata edits use the unchanged observer's Central entitlement", async (t) => {
  const observerId = "00000000-0000-4000-8000-000000000001";
  const staffId = "00000000-0000-4000-8000-000000000002";
  const observationId = "00000000-0000-4000-8000-000000000003";
  for (const [role, expectedStatus] of [["INSTRUCTIONAL_COACH", 200], ["STAFF", 400]] as const) {
    await t.test(role, async (t) => {
      const environment = {
        NODE_ENV: "test", PROOFPOINT_AUTH_MODE: "hub",
        CENTRAL_API_BASE_URL: "https://central.example.test/api/internal",
        CENTRAL_API_TOKEN: "test-token", CENTRAL_ORGANIZATION_ID: "test-org",
      };
      const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
      Object.assign(process.env, environment);
      clearCentralEntitlementCacheForTest();
      setObservationTestActor({ id: "admin", roles: ["admin"] });
      t.after(() => {
        setObservationTestActor(null);
        clearCentralEntitlementCacheForTest();
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      });
      let savedTitle: unknown;
      const client = {
        release() {},
        async query(sql: string, values?: unknown[]) {
          if (sql.includes("FOR UPDATE OF o")) return { rows: [{
            id: observationId, managerId: observerId, templateId: "rubric", status: "draft",
            title: "Old title", description: null, observationDate: null, dueAt: null,
            scopeType: "INDIVIDUAL", className: null, subjectName: null,
            rubricName: "Rubric", managerEmail: "coach@example.test", managerName: "Coach",
          }] };
          if (sql.includes("FOR UPDATE OF op")) return { rows: [
            { id: staffId, email: "staff@example.test", fullName: "Staff" },
          ] };
          if (sql.includes('AS "membershipRoles"')) return { rows: [{
            id: observerId, email: "coach@example.test", fullName: "Coach",
            centralPersonId: "central-coach", membershipRoles: [],
          }] };
          if (sql.includes("AS eligible")) return { rows: [{
            id: observerId, email: "coach@example.test", fullName: "Coach",
            eligible: false, isAdmin: false,
          }] };
          if (sql.includes("UPDATE observations")) savedTitle = values?.[3];
          else if (!["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
            throw new Error(`Unexpected query: ${sql}`);
          }
          return { rows: [] };
        },
      };
      t.mock.method(pool, "connect", async () => client);
      t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/api/internal/application-entitlements/lookup");
        assert.equal(url.searchParams.get("person_id"), "central-coach");
        return Response.json({ data: {
          id: "entitlement", person_id: "central-coach", application_id: "proofpoint",
          organization_id: "test-org", role, permissions: ["proofpoint.access"],
          version: 1, is_active: true,
        } });
      });

      const response = await PATCH(new NextRequest(`http://localhost/api/observations/${observationId}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Updated by admin" }),
      }), { params: Promise.resolve({ id: observationId }) });

      assert.equal(response.status, expectedStatus, JSON.stringify(await response.json()));
      assert.equal(savedTitle, expectedStatus === 200 ? "Updated by admin" : undefined);
    });
  }
});
