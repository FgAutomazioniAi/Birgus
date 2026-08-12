import assert from "node:assert/strict";
import { test } from "node:test";

import { PasswordHasher } from "../../src/modules/identity/services/PasswordHasher.js";

test("PasswordHasher verifies the original password and rejects wrong values", async () => {
  const hasher = new PasswordHasher("test-pepper");
  const storedHash = await hasher.hashPassword("Correct Horse Battery Staple");

  assert.equal(await hasher.verifyPassword("Correct Horse Battery Staple", storedHash), true);
  assert.equal(await hasher.verifyPassword("wrong-password", storedHash), false);
});

test("PasswordHasher rejects malformed stored hashes", async () => {
  const hasher = new PasswordHasher("test-pepper");

  assert.equal(await hasher.verifyPassword("anything", "not-a-valid-hash"), false);
});
