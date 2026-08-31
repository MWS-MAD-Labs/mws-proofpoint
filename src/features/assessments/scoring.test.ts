import test from "node:test";
import assert from "node:assert/strict";
import { getGradeFromScore } from "./scoring";

test("grades using the score rounded to two decimals", () => {
  assert.equal(getGradeFromScore(3.195972222), "Solid Foundation");
  assert.equal(getGradeFromScore(3.194), "Developing Under Guidance");
  assert.equal(getGradeFromScore(3.205), "Solid Foundation");
});
