import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { OpenAiCompatibleLmClient } from "../../src/modules/ai-runtime/services/OpenAiCompatibleLmClient.js";
import { OpenAiCompatibleToolChatClient } from "../../src/modules/ai-runtime/services/OpenAiCompatibleToolChatClient.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("OpenAiCompatibleLmClient calls OpenAI-compatible models and chat endpoints with Bearer auth", async () => {
  const calls: Array<{ url: string; authorization: string | null; body: Record<string, unknown> | null }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      authorization: headers.get("authorization"),
      body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null,
    });

    if (url.endsWith("/v1/models")) {
      return Response.json({ data: [{ id: "qwen-test", object: "model" }] });
    }

    return Response.json({
      id: "chatcmpl-test",
      model: "qwen-test",
      choices: [{ message: { role: "assistant", content: "{\"ok\":true}" } }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    });
  }) as typeof fetch;

  const client = new OpenAiCompatibleLmClient({
    baseUrl: "http://vllm:8000/v1",
    apiKey: "secret-token",
    requestedModel: "qwen-test",
    completionsPath: "/v1/chat/completions",
    modelsPath: "/v1/models",
  });

  const result = await client.completeJsonSchema({
    systemPrompt: "Rispondi in JSON.",
    userContext: "test",
    schemaName: "smoke",
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
  });

  assert.equal(result.model, "qwen-test");
  assert.equal(result.content, "{\"ok\":true}");
  assert.deepEqual(calls.map((call) => call.url), [
    "http://vllm:8000/v1/models",
    "http://vllm:8000/v1/chat/completions",
  ]);
  assert.equal(calls[0]?.authorization, "Bearer secret-token");
  assert.equal(calls[1]?.authorization, "Bearer secret-token");
  assert.equal(calls[1]?.body?.model, "qwen-test");
  assert.deepEqual(calls[1]?.body?.response_format, {
    type: "json_schema",
    json_schema: {
      name: "smoke",
      strict: true,
      schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
    },
  });
});

test("OpenAiCompatibleLmClient uses requested model when model listing is unavailable", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);

    if (url.endsWith("/v1/models")) {
      return new Response("down", { status: 503 });
    }

    return Response.json({
      id: "chatcmpl-test",
      choices: [{ message: { role: "assistant", content: "ok" } }],
    });
  }) as typeof fetch;

  const client = new OpenAiCompatibleLmClient({
    baseUrl: "http://127.0.0.1:8000",
    requestedModel: "offline-model",
  });

  const result = await client.chat("ciao");

  assert.equal(result.model, "offline-model");
  assert.deepEqual(result.response.output, [{ type: "text", content: "ok" }]);
  assert.deepEqual(calls, [
    "http://127.0.0.1:8000/v1/models",
    "http://127.0.0.1:8000/v1/chat/completions",
  ]);
});

test("OpenAiCompatibleLmClient reports provider HTTP failures without response payload", async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/v1/models")) {
      return Response.json({ data: [] });
    }

    return Response.json({ error: "sensitive provider payload" }, { status: 401 });
  }) as typeof fetch;

  const client = new OpenAiCompatibleLmClient({
    baseUrl: "http://vllm:8000",
    requestedModel: "model-from-config",
  });

  await assert.rejects(
    () => client.completeJsonSchema({
      systemPrompt: "system",
      userContext: "user",
      schemaName: "schema",
      schema: { type: "object" },
    }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "AI_PROVIDER_UNAUTHORIZED");
      assert.doesNotMatch(error.message, /sensitive provider payload/);
      return true;
    },
  );
});

test("OpenAiCompatibleLmClient reports timeout without low-level details", async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/v1/models")) {
      return new Response("down", { status: 503 });
    }

    throw new DOMException("The operation was aborted.", "TimeoutError");
  }) as typeof fetch;

  const client = new OpenAiCompatibleLmClient({
    baseUrl: "http://vllm:8000",
    requestedModel: "qwen-test",
  });

  await assert.rejects(
    () => client.chat("ciao"),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "AI_PROVIDER_TIMEOUT");
      assert.doesNotMatch(error.message, /aborted/i);
      return true;
    },
  );
});

test("OpenAiCompatibleLmClient classifies an unreachable models endpoint", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;

  const client = new OpenAiCompatibleLmClient({
    baseUrl: "http://192.0.2.10:8000",
    requestedModel: "qwen-test",
  });

  await assert.rejects(
    () => client.discoverModelsStrict(),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "AI_PROVIDER_NETWORK_UNREACHABLE");
      return true;
    },
  );
});

test("OpenAiCompatibleLmClient rejects empty assistant responses", async () => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/v1/models")) {
      return new Response("down", { status: 503 });
    }

    return Response.json({
      id: "chatcmpl-empty",
      choices: [{ message: { role: "assistant", content: "   " } }],
    });
  }) as typeof fetch;

  const client = new OpenAiCompatibleLmClient({
    baseUrl: "http://vllm:8000",
    requestedModel: "qwen-test",
  });

  await assert.rejects(
    () => client.chat("ciao"),
    /AI provider ha restituito risposta vuota/,
  );
});

test("OpenAiCompatibleToolChatClient omits tool fields for plain chat", async () => {
  const completionBodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/v1/models")) {
      return new Response("not available", { status: 503 });
    }

    completionBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
    return Response.json({
      id: "chatcmpl-test",
      choices: [{ message: { role: "assistant", content: "ciao" } }],
    });
  }) as typeof fetch;

  const chatClient = new OpenAiCompatibleToolChatClient(
    new OpenAiCompatibleLmClient({
      baseUrl: "http://vllm:8000",
      requestedModel: "qwen-test",
    }),
  );

  const result = await chatClient.chat({
    messages: [{ role: "user", content: "ciao" }],
  });

  assert.equal(result.content, "ciao");
  assert.equal(completionBodies.length, 1);
  assert.equal("tools" in (completionBodies[0] ?? {}), false);
  assert.equal("tool_choice" in (completionBodies[0] ?? {}), false);
});
