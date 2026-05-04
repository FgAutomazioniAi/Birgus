import { PythonModulesExecuteResult } from "./types";

const defaultBaseUrl = "http://python_modules:8200";
const defaultExecutePath = "/v1/modules/execute";

function normalizePath(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

export class PythonModulesClient {
  private readonly baseUrl: string;
  private readonly executePath: string;
  private readonly timeoutMs: number;

  public constructor() {
    this.baseUrl = (process.env.PYTHON_MODULES_BASE_URL ?? defaultBaseUrl).replace(/\/+$/, "");
    this.executePath = normalizePath(process.env.PYTHON_MODULES_EXECUTE_PATH ?? defaultExecutePath);
    this.timeoutMs = this.parsePositiveInt(process.env.PYTHON_MODULES_TIMEOUT_MS, 180000);
  }

  public async execute(module: string, action: string, input: Record<string, unknown>): Promise<PythonModulesExecuteResult> {
    const response = await fetch(`${this.baseUrl}${this.executePath}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ module, action, input }),
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = typeof payload?.detail === "string" ? payload.detail : "Python modules error";
      throw new Error(`python_modules HTTP ${response.status}: ${detail}`);
    }

    return payload as PythonModulesExecuteResult;
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
