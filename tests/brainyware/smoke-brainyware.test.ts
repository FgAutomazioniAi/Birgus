import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBrainywareBaseUrl } from "../../scripts/smoke-brainyware.js";

test("normalizes the Brainyware base URL without exposing credentials", () => {
  assert.equal(normalizeBrainywareBaseUrl("https://brainy.example.test/"), "https://brainy.example.test");
  assert.equal(normalizeBrainywareBaseUrl("https://brainy.example.test/root/?ignored=1"), "https://brainy.example.test/root");
});
