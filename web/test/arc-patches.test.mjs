import assert from "node:assert/strict";
import { test } from "node:test";
import { missingPatches } from "../scripts/arc-patches.mjs";

test("every Arc component carries the local Portuguese copy and props", () => {
  assert.deepEqual(missingPatches(), []);
});
