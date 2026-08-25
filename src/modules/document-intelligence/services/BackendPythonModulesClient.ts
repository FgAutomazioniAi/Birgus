export class BackendPythonModulesClient {
  private readonly baseUrl: string;
  private readonly executePath: string;
  private readonly timeoutMs: number;
  private readonly ocrBaseUrl: string;
  private readonly ocrExecutePath: string;
  private readonly ocrTimeoutMs: number;
  private readonly ocrLifecycleBaseUrl: string;
  private readonly ocrLifecycleToken: string;

  public constructor() {
    this.baseUrl = (process.env.PYTHON_MODULES_BASE_URL ?? "http://python_modules:8200").replace(/\/+$/, "");
    this.executePath = this.normalizePath(process.env.PYTHON_MODULES_EXECUTE_PATH ?? "/v1/modules/execute");
    this.timeoutMs = this.toPositiveInt(process.env.PYTHON_MODULES_TIMEOUT_MS, 180000);
    this.ocrBaseUrl = (process.env.OCR_ENGINE_BASE_URL ?? "http://ocr_engine:8201").replace(/\/+$/, "");
    this.ocrExecutePath = this.normalizePath(process.env.OCR_ENGINE_EXECUTE_PATH ?? "/v1/modules/execute");
    this.ocrTimeoutMs = this.toPositiveInt(process.env.OCR_ENGINE_TIMEOUT_MS, 180000);
    this.ocrLifecycleBaseUrl = (process.env.OCR_LIFECYCLE_BASE_URL ?? "http://ocr_lifecycle:8202").replace(/\/+$/, "");
    this.ocrLifecycleToken = process.env.OCR_LIFECYCLE_TOKEN ?? "";
  }

  public async execute(module: string, action: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const isOcrRequest = module === "ocr_engine";
    const baseUrl = isOcrRequest ? this.ocrBaseUrl : this.baseUrl;
    const executePath = isOcrRequest ? this.ocrExecutePath : this.executePath;
    const timeoutMs = isOcrRequest ? this.ocrTimeoutMs : this.timeoutMs;
    const response = await fetch(`${baseUrl}${executePath}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ module, action, input }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const serviceName = isOcrRequest ? "ocr_engine" : "python_modules";
      const detail = typeof payload?.detail === "string" ? payload.detail : `${serviceName} HTTP ${response.status}`;
      throw new Error(detail);
    }

    return payload as Record<string, unknown>;
  }

  public async startOcrContainer(): Promise<{ running: boolean }> {
    return this.updateOcrContainer("start");
  }

  public async stopOcrContainer(): Promise<{ running: boolean }> {
    return this.updateOcrContainer("stop");
  }

  public async getOcrRuntimeStatus(): Promise<{
    containerRunning: boolean;
    state: "stopped" | "idle" | "starting" | "ready" | "failed";
    modelLoaded: boolean;
    error: string | null;
  }> {
    const container = await this.getOcrContainerStatus();
    if (!container.running) {
      return { containerRunning: false, state: "stopped", modelLoaded: false, error: null };
    }

    const response = await fetch(`${this.ocrBaseUrl}/v1/runtime/status`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      return { containerRunning: true, state: "starting", modelLoaded: false, error: null };
    }

    const state = payload.state;
    return {
      containerRunning: true,
      state: state === "ready" || state === "failed" || state === "idle" ? state : "starting",
      modelLoaded: payload.model_loaded === true,
      error: typeof payload.error === "string" ? payload.error : null,
    };
  }

  private async updateOcrContainer(action: "start" | "stop"): Promise<{ running: boolean }> {
    return this.callOcrLifecycle(`/v1/ocr/${action}`);
  }

  private async getOcrContainerStatus(): Promise<{ running: boolean }> {
    return this.callOcrLifecycle("/v1/ocr/status", "GET");
  }

  private async callOcrLifecycle(path: string, method = "POST"): Promise<{ running: boolean }> {
    if (!this.ocrLifecycleToken) {
      throw new Error("OCR lifecycle token is not configured");
    }

    const response = await fetch(`${this.ocrLifecycleBaseUrl}${path}`, {
      method,
      headers: { "x-ocr-lifecycle-token": this.ocrLifecycleToken },
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(typeof payload.detail === "string" ? payload.detail : `OCR lifecycle HTTP ${response.status}`);
    }

    return { running: payload.running === true };
  }

  private normalizePath(value: string): string {
    return value.startsWith("/") ? value : `/${value}`;
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
