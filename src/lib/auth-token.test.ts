import assert from "node:assert/strict";
import test from "node:test";
import { refreshAuthToken } from "./auth-token";

test("active user refreshes token authorization fields", async () => {
  const token = { id: "user-1", roles: ["staff"], departmentId: null };
  const result = await refreshAuthToken(token, async () => ({
    id: "user-1",
    roles: ["manager"],
    departmentId: "department-1",
  }));

  assert.equal(result, token);
  assert.deepEqual(result, {
    id: "user-1",
    roles: ["manager"],
    departmentId: "department-1",
  });
});

test("inactive or deleted user revokes the token", async () => {
  assert.equal(await refreshAuthToken({ id: "user-1" }, async () => null), null);
});

test("transient lookup failure retains the existing token", async () => {
  const token = { id: "user-1", roles: ["staff"] };
  const error = new Error("database unavailable");
  let reportedError: unknown;
  const result = await refreshAuthToken(
    token,
    async () => { throw error; },
    (caught) => { reportedError = caught; },
  );

  assert.equal(result, token);
  assert.equal(reportedError, error);
});
