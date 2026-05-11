import assert from "node:assert/strict";

type JsonRecord = Record<string, unknown>;

const backendBaseUrl = process.env.SMOKE_API_BASE_URL ?? "http://localhost:3000";
const frontendBaseUrl = process.env.SMOKE_FRONTEND_BASE_URL ?? "http://localhost:3100";
const loginEmail = process.env.SMOKE_LOGIN_EMAIL ?? "superuser@birgus.it";
const loginPassword = process.env.SMOKE_LOGIN_PASSWORD ?? "admin";

function url(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

async function requestJson(
  input: string,
  init?: RequestInit,
): Promise<{ status: number; body: JsonRecord; headers: Headers }> {
  const response = await fetch(input, init);
  const text = await response.text();
  const body = text ? (JSON.parse(text) as JsonRecord) : {};
  return { status: response.status, body, headers: response.headers };
}

async function run(): Promise<void> {
  const health = await requestJson(url(backendBaseUrl, "/health"));
  assert.equal(health.status, 200, "backend /health must be 200");
  assert.equal(health.body.ok, true, "backend health payload must contain ok=true");

  const frontendLogin = await fetch(url(frontendBaseUrl, "/login"));
  assert.equal(frontendLogin.status, 200, "frontend /login must be 200");

  const unauthSession = await requestJson(url(backendBaseUrl, "/api/auth/session"));
  assert.equal(unauthSession.status, 401, "/api/auth/session without auth must be 401");

  const login = await requestJson(url(backendBaseUrl, "/api/auth/login"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: loginEmail,
      password: loginPassword,
      rememberMe: true,
    }),
  });

  assert.equal(login.status, 200, "login must be 200");
  assert.equal(login.body.ok, true, "login response must contain ok=true");

  const token = typeof login.body.token === "string" ? login.body.token : null;
  assert.ok(token, "login must provide token");

  const session = await requestJson(url(backendBaseUrl, "/api/auth/session"), {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(session.status, 200, "authenticated session must be 200");
  const workspaceId = typeof session.body.workspaceId === "string" ? session.body.workspaceId : null;
  assert.ok(workspaceId, "authenticated session must provide workspaceId");

  const clients = await requestJson(url(backendBaseUrl, "/api/clients"), {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(clients.status, 200, "/api/clients must be 200 for authenticated user");
  assert.ok(Array.isArray(clients.body), "/api/clients must return an array");

  const ddtConfig = await requestJson(url(backendBaseUrl, "/api/ddt-reader/config"), {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(ddtConfig.status, 200, "/api/ddt-reader/config must be 200");

  const unknownJob = await requestJson(url(backendBaseUrl, "/api/orchestrator/jobs/00000000-0000-0000-0000-000000000000"), {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(unknownJob.status, 404, "unknown orchestrator job must be 404");

  const modules = await requestJson(url(backendBaseUrl, "/api/modules"), {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(modules.status, 200, "/api/modules must be 200");
  assert.ok(Array.isArray(modules.body.modules), "/api/modules must return modules array");

  const assistantSession = await requestJson(url(backendBaseUrl, "/api/assistant/sessions"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "x-workspace-id": workspaceId,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Smoke assistant",
      moduleKey: "project_management",
    }),
  });
  assert.equal(assistantSession.status, 201, "assistant session creation must be 201");
  const assistantSessionId = typeof assistantSession.body.id === "string" ? assistantSession.body.id : null;
  assert.ok(assistantSessionId, "assistant session must return id");

  const knowledgeSearch = await requestJson(url(backendBaseUrl, "/api/knowledge/search?query=preventivo"), {
    headers: {
      authorization: `Bearer ${token}`,
      "x-workspace-id": workspaceId,
    },
  });
  assert.equal(knowledgeSearch.status, 200, "knowledge search must be 200");
  assert.ok(Array.isArray(knowledgeSearch.body.hits), "knowledge search must return hits array");

  console.log("Smoke test passed.");
  console.log(
    JSON.stringify(
      {
        backendBaseUrl,
        frontendBaseUrl,
        checked: [
          "GET /health",
          "GET /login",
          "POST /api/auth/login",
          "GET /api/auth/session",
          "GET /api/clients",
          "GET /api/ddt-reader/config",
          "GET /api/orchestrator/jobs/non-existing",
          "GET /api/modules",
          "POST /api/assistant/sessions",
          "GET /api/knowledge/search",
        ],
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("Smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});
