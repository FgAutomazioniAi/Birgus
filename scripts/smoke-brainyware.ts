import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

type JsonRecord = Record<string, unknown>;

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) throw new Error(`${name} non configurato.`);
  return normalized;
}

export function normalizeBrainywareBaseUrl(value: string): string {
  const url = new URL(required(value, "BRAINYWARE_BASE_URL"));
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function readSecret(pathVariable: string): Promise<string> {
  const path = required(process.env[pathVariable], pathVariable);
  return required(await readFile(path, "utf8"), pathVariable);
}

function findToken(payload: JsonRecord): string | null {
  for (const key of ["token", "access_token", "accessToken", "jwt"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const data = payload.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return findToken(data as JsonRecord);
  }
  return null;
}

async function readJsonResponse(response: Response): Promise<JsonRecord> {
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`Brainyware ha restituito una risposta non valida (HTTP ${response.status}).`);
  }
  return payload as JsonRecord;
}

export async function smokeBrainyware(): Promise<void> {
  const baseUrl = normalizeBrainywareBaseUrl(required(process.env.BRAINYWARE_BASE_URL, "BRAINYWARE_BASE_URL"));
  const accessKey = await readSecret("BRAINYWARE_ACCESS_KEY_FILE");
  const secretKey = await readSecret("BRAINYWARE_SECRET_KEY_FILE");

  const loginResponse = await fetch(`${baseUrl}/brainy/api/auth/service`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_key: accessKey, secret_key: secretKey }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!loginResponse.ok) {
    throw new Error(`Autenticazione Brainyware non riuscita (HTTP ${loginResponse.status}).`);
  }

  const loginPayload = await readJsonResponse(loginResponse);
  const token = findToken(loginPayload);
  if (!token) {
    throw new Error("Autenticazione riuscita, ma Brainyware non ha restituito un token riconoscibile.");
  }

  const identityResponse = await fetch(`${baseUrl}/brainy/api/auth`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!identityResponse.ok) {
    throw new Error(`Verifica identita Brainyware non riuscita (HTTP ${identityResponse.status}).`);
  }

  const identity = await readJsonResponse(identityResponse);
  console.log(JSON.stringify({
    ok: true,
    id: identity.id ?? null,
    name: identity.name ?? identity.login ?? null,
    profile: identity.profile ?? null,
    admin: identity.admin ?? null,
    organizationId: identity.organization_id ?? null,
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  smokeBrainyware().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Test Brainyware non riuscito.");
    process.exitCode = 1;
  });
}
