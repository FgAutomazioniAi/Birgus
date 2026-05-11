export class BackendPythonModulesClient {
  private readonly baseUrl: string;
  private readonly executePath: string;
  private readonly timeoutMs: number;

  public constructor() {
    this.baseUrl = (process.env.PYTHON_MODULES_BASE_URL ?? "http://python_modules:8200").replace(/\/+$/, "");
    this.executePath = this.normalizePath(process.env.PYTHON_MODULES_EXECUTE_PATH ?? "/v1/modules/execute");
    this.timeoutMs = this.toPositiveInt(process.env.PYTHON_MODULES_TIMEOUT_MS, 180000);
  }

  public async execute(module: string, action: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
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
      const detail = typeof payload?.detail === "string" ? payload.detail : `python_modules HTTP ${response.status}`;
      throw new Error(detail);
    }

    return payload as Record<string, unknown>;
  }

  private normalizePath(value: string): string {
    return value.startsWith("/") ? value : `/${value}`;
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
