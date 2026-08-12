import { AiGatewayService } from "../src/modules/ai-runtime/services/AiGatewayService.js";
import { OpenAiCompatibleLmClient } from "../src/modules/ai-runtime/services/OpenAiCompatibleLmClient.js";

const client = new OpenAiCompatibleLmClient();
const gateway = new AiGatewayService(client);

const health = await gateway.health();
if (!health.ok || !health.model) {
  throw new Error(`AI provider health failed: ${health.error ?? "unknown error"}`);
}

const result = await client.chat("Rispondi solo con: vllm-ok");
const text = result.response.output?.[0]?.content ?? "";
if (!text.trim()) {
  throw new Error("AI provider smoke failed: empty chat response");
}

console.log(JSON.stringify({
  ok: true,
  model: health.model,
  responsePreview: text.trim().slice(0, 80),
}, null, 2));
