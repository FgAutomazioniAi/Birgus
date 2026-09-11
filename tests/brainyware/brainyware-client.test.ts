import assert from "node:assert/strict";
import test from "node:test";

import { BrainywareClient } from "../../src/modules/brainyware/services/BrainywareClient.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("agent session creation accepts the documented loaded-session response", async () => {
  const client = new BrainywareClient({
    baseUrl: "https://brainyware.example",
    accessKey: "access-test",
    secretKey: "secret-test",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/brainy/api/auth/service")) return jsonResponse({ token: "brainy-token" });
      if (url.endsWith("/brainy/api/ai/agents/agent-1/sessions")) return jsonResponse({ session: { id: "session-1" } });
      throw new Error(`Unexpected request: ${url}`);
    },
  });

  const session = await client.createAgentSession("agent-1", "Nuova chat");

  assert.equal(session.id, "session-1");
});

test("agent run creates and returns the Brainyware session from the SSE begin event", async () => {
  const client = new BrainywareClient({
    baseUrl: "https://brainyware.example",
    accessKey: "access-test",
    secretKey: "secret-test",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/brainy/api/auth/service")) return jsonResponse({ token: "brainy-token" });
      if (url.endsWith("/brainy/api/ai/agents/agent-1/run")) {
        return new Response([
          "event: BEGIN",
          'data: {"session_id":"session-1","role":"user","content":"Ciao"}',
          "",
          "event: CHUNK",
          'data: {"role":"agent","content":"Risposta"}',
          "",
          "event: END",
          'data: {"session_id":"session-1","role":"agent","content":"Risposta"}',
          "",
        ].join("\n"), { headers: { "Content-Type": "text/event-stream" } });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });

  const result = await client.runAgent({ agentId: "agent-1", sessionId: "", sessionName: "Nuova chat", message: "Ciao" });

  assert.equal(result.sessionId, "session-1");
  assert.equal(result.reply, "Risposta");
});

test("agent stream forwards chunks without duplicating the final SSE event", async () => {
  const client = new BrainywareClient({
    baseUrl: "https://brainyware.example",
    accessKey: "access-test",
    secretKey: "secret-test",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/brainy/api/auth/service")) return jsonResponse({ token: "brainy-token" });
      if (url.endsWith("/brainy/api/ai/agents/agent-1/run")) {
        return new Response([
          "event: CHUNK",
          'data: {"role":"agent","content":"Risposta "}',
          "",
          "event: CHUNK",
          'data: {"role":"agent","content":"in streaming"}',
          "",
          "event: END",
          'data: {"role":"agent","content":"Risposta in streaming"}',
          "",
        ].join("\n"), { headers: { "Content-Type": "text/event-stream" } });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  });

  const chunks: string[] = [];
  for await (const chunk of client.runAgentStream({ agentId: "agent-1", sessionId: "", sessionName: "Nuova chat", message: "Ciao" })) {
    chunks.push(chunk);
  }

  assert.deepEqual(chunks, ["Risposta ", "in streaming"]);
});

test("single-shot agent inference removes the temporary Brainyware session", async () => {
  const requests: string[] = [];
  const client = new BrainywareClient({
    baseUrl: "https://brainyware.example",
    accessKey: "access-test",
    secretKey: "secret-test",
    fetchImpl: async (input, init) => {
      const url = String(input); requests.push(url);
      if (url.endsWith("/brainy/api/auth/service")) return jsonResponse({ token: "brainy-token" });
      if (url.endsWith("/brainy/api/ai/agents/agent-1/run")) {
        const body = JSON.parse(String(init?.body)) as { session_id?: string };
        assert.equal(body.session_id, "");
        return new Response(["event: END", 'data: {"session_id":"temporary-1","role":"agent","content":"Risposta"}', ""].join("\n"), { headers: { "Content-Type": "text/event-stream" } });
      }
      if (url.endsWith("/brainy/api/ai/agents/agent-1/sessions/temporary-1")) return new Response(null, { status: 204 });
      throw new Error(`Unexpected request: ${url}`);
    },
  });

  const result = await client.runAgentSingleShot({ agentId: "agent-1", message: "Ciao" });

  assert.equal(result.reply, "Risposta");
  assert.equal(result.persistentSession, false);
  assert.ok(requests.some((url) => url.endsWith("/brainy/api/ai/agents/agent-1/sessions/temporary-1")));
});

test("database inference uses the stateless Langflow bridge with empty history", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const client = new BrainywareClient({
    baseUrl: "https://brainyware.example",
    accessKey: "access-test",
    secretKey: "secret-test",
    fetchImpl: async (input, init) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      requests.push({ url, body });
      if (url.endsWith("/brainy/api/auth/service")) return jsonResponse({ token: "token-test" });
      if (url.endsWith("/brainy/api/database/connections/lf/list")) return jsonResponse({ rows: [{ id: "42", name: "ERP", access_mode: "READ_ONLY" }] });
      return jsonResponse({ answer: "Risposta dal database" });
    },
  });

  const result = await client.inferStateless({
    message: "Quanti ordini sono aperti?",
    connectionId: "42",
    instructions: "Rispondi brevemente.",
  });

  assert.equal(result.reply, "Risposta dal database");
  assert.equal(result.mode, "database");
  assert.equal(result.persistentSession, false);
  assert.equal(requests[2].url, "https://brainyware.example/brainy/api/database/connections/lf/42/chat");
  assert.deepEqual(requests[2].body.history, []);
  assert.equal("session_id" in requests[2].body, false);
  assert.equal("sessionId" in requests[2].body, false);
});

test("model inference uses the OpenAI-compatible endpoint without sessions", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const client = new BrainywareClient({
    baseUrl: "https://brainyware.example/",
    accessKey: "access-test",
    secretKey: "secret-test",
    fetchImpl: async (input, init) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      requests.push({ url, body });
      if (url.endsWith("/brainy/api/auth/service")) return jsonResponse({ access_token: "token-test" });
      return jsonResponse({ choices: [{ message: { content: "Risposta dal modello" } }] });
    },
  });

  const result = await client.inferStateless({ message: "Analizza", mode: "model", model: "model-1" });

  assert.equal(result.reply, "Risposta dal modello");
  assert.equal(result.mode, "model");
  assert.equal(result.persistentSession, false);
  assert.equal(requests[1].url, "https://brainyware.example/brainy/api/openai/v1/chat/completions");
  assert.equal("session_id" in requests[1].body, false);
  assert.equal("history" in requests[1].body, false);
});

test("database inference requires a choice when multiple connections are accessible", async () => {
  const client = new BrainywareClient({
    baseUrl: "https://brainyware.example",
    accessKey: "access-test",
    secretKey: "secret-test",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/brainy/api/auth/service")) return jsonResponse({ token: "token-test" });
      if (url.endsWith("/brainy/api/database/connections/lf/list")) {
        return jsonResponse({ rows: [{ id: 1, name: "ERP" }, { id: 2, name: "CRM" }] });
      }
      return jsonResponse({ answer: "unexpected" });
    },
  });

  await assert.rejects(
    () => client.inferStateless({ message: "Analizza" }),
    /Selezionare il database Brainyware/,
  );
});
