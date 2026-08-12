import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { PrismaClientManager } from "../../src/database/PrismaClientManager.js";
import { LmStudioDdtAnalyzer } from "../../src/modules/ddt-processing/services/LmStudioDdtAnalyzer.js";
import { GaragePath } from "../../src/storage/GaragePath.js";
import type { ProjectBinaryStorage } from "../../src/storage/ProjectBinaryStorage.js";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test("LmStudioDdtAnalyzer uses OpenAI-compatible chat completions and validates DDT JSON", async () => {
  process.env.DDT_READER_LM_BASE_URL = "http://vllm:8000/v1";
  process.env.DDT_READER_LM_MODEL = "birgus-vl";
  process.env.DDT_READER_LM_API_KEY = "provider-token";
  process.env.DDT_READER_LM_COMPLETIONS_PATH = "/v1/chat/completions";
  process.env.DDT_READER_LM_MODELS_PATH = "/v1/models";
  process.env.ORCH_DDT_LM_MAX_TOKENS = "300";

  const storagePath = GaragePath.toStoragePath("birgus-files", "ddt/test.pdf");
  PrismaClientManager.setClient({
    ddtDocument: {
      findUnique: async () => ({
        original_filename: "ddt-test.pdf",
        document: {
          filename: "ddt-test.pdf",
          storage_path: storagePath,
        },
      }),
    },
  } as never);

  const storage: ProjectBinaryStorage = {
    defaultBucket: () => "birgus-files",
    storagePrefix: () => "projects",
    sha256Hex: () => "hash",
    putObject: async () => ({
      bucket: "birgus-files",
      objectKey: "ddt/test.pdf",
      contentType: "application/pdf",
      etag: null,
      size: null,
    }),
    headObject: async () => ({
      bucket: "birgus-files",
      objectKey: "ddt/test.pdf",
      contentType: "application/pdf",
      etag: null,
      size: null,
    }),
    deleteObject: async () => undefined,
    getObject: async () => ({
      bucket: "birgus-files",
      objectKey: "ddt/test.pdf",
      contentType: "application/pdf",
      etag: null,
      size: null,
      metadata: {},
      bytes: Buffer.from("DDT numero 7 FG Automazioni destinatario articolo vite quantita 3 PZ", "latin1"),
    }),
  };

  const calls: Array<{ url: string; authorization: string | null; body: Record<string, unknown> | null }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      authorization: headers.get("authorization"),
      body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null,
    });

    assert.doesNotMatch(url, /\/api\/v1\/chat/);

    if (url.endsWith("/v1/models")) {
      return Response.json({ data: [{ id: "birgus-vl", object: "model" }] });
    }

    return Response.json({
      id: "chatcmpl-ddt",
      model: "birgus-vl",
      choices: [{
        message: {
          role: "assistant",
          content: JSON.stringify({
            movement_type: "entrata",
            movement_scope: "esterno",
            main_warehouse_action: "aggiunta_principale",
            bolla_number: "7",
            commessa_reference: "",
            transfer_note: "",
            article_count: 1,
            article_items: [{ article_type: "vite", quantity: 3, unit: "PZ" }],
            analysis_summary: "DDT in entrata.",
          }),
        },
      }],
    });
  }) as typeof fetch;

  const analyzer = new LmStudioDdtAnalyzer(storage);
  const result = await analyzer.analyze("ddt-document-id");

  assert.equal(result.movementType, "entrata");
  assert.equal(result.articleCount, 1);
  assert.deepEqual(result.articleItems, [{ articleType: "vite", quantity: 3, unit: "PZ" }]);
  assert.equal(result.rawResponse?.provider, "openai-compatible-chat-completions-json-schema");
  assert.deepEqual(calls.map((call) => call.url), [
    "http://vllm:8000/v1/models",
    "http://vllm:8000/v1/chat/completions",
  ]);
  assert.equal(calls[1]?.authorization, "Bearer provider-token");
  assert.equal(calls[1]?.body?.model, "birgus-vl");
  const responseFormat = calls[1]?.body?.response_format as {
    type?: string;
    json_schema?: { name?: string; strict?: boolean; schema?: { required?: string[] } };
  } | undefined;
  assert.equal(responseFormat?.type, "json_schema");
  assert.equal(responseFormat?.json_schema?.name, "ddt_analysis");
  assert.equal(responseFormat?.json_schema?.strict, true);
  assert.ok(responseFormat?.json_schema?.schema?.required?.includes("movement_type"));
  assert.ok(responseFormat?.json_schema?.schema?.required?.includes("article_items"));
});
