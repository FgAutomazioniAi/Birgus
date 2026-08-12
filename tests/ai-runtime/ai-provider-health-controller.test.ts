import assert from "node:assert/strict";
import { test } from "node:test";

import { HealthController } from "../../src/nest/health/health.controller.js";
import type { AiGatewayService } from "../../src/modules/ai-runtime/services/AiGatewayService.js";

function buildController(health: Awaited<ReturnType<AiGatewayService["health"]>>): HealthController {
  const gateway = {
    health: async () => health,
  } as AiGatewayService;

  return new HealthController(gateway);
}

test("HealthController exposes AI provider health without raw provider payloads", async () => {
  const controller = buildController({
    ok: true,
    model: "qwen-test",
    error: null,
  });

  const response = await controller.getAiProviderHealth();

  assert.equal(response.ok, true);
  assert.equal(response.provider, "openai-compatible");
  assert.equal(response.model, "qwen-test");
  assert.equal(response.error, null);
  assert.match(response.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("HealthController reports AI provider failures with normalized errors", async () => {
  const controller = buildController({
    ok: false,
    model: null,
    error: "AI provider request timeout",
  });

  const response = await controller.getAiProviderHealth();

  assert.equal(response.ok, false);
  assert.equal(response.model, null);
  assert.equal(response.error, "AI provider request timeout");
});
