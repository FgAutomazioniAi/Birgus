import { AppError } from "../../../core/errors/AppError.js";

export interface VllmRuntimeStatus {
  configuredMaxModelLen: number | null;
  containerRunning: boolean;
  targetContainer: string;
}

export class VllmLifecycleService {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;

  public constructor() {
    this.baseUrl = (process.env.VLLM_LIFECYCLE_BASE_URL ?? "http://vllm_lifecycle:8203").replace(/\/+$/, "");
    this.token = (process.env.VLLM_LIFECYCLE_TOKEN ?? "").trim();
    this.timeoutMs = this.toPositiveInt(process.env.VLLM_LIFECYCLE_TIMEOUT_MS, 190_000);
  }

  public async getRuntimeStatus(): Promise<VllmRuntimeStatus> {
    return this.request("/v1/vllm/status", { method: "GET" });
  }

  public async updateMaxModelLen(maxModelLen: number): Promise<VllmRuntimeStatus> {
    if (!Number.isInteger(maxModelLen) || maxModelLen < 1024 || maxModelLen > 32768) {
      throw new AppError("Il contesto vLLM deve essere compreso tra 1024 e 32768 token.", "VLLM_CONTEXT_LIMIT_INVALID", 400);
    }
    return this.request("/v1/vllm/max-model-len", {
      method: "POST",
      body: JSON.stringify({ max_model_len: maxModelLen }),
    });
  }

  private async request(path: string, init: RequestInit): Promise<VllmRuntimeStatus> {
    if (!this.token) {
      throw new AppError("Lifecycle vLLM non configurato.", "VLLM_LIFECYCLE_NOT_CONFIGURED", 503);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-vllm-lifecycle-token": this.token,
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
    } catch {
      throw new AppError("Lifecycle vLLM non raggiungibile.", "VLLM_LIFECYCLE_UNAVAILABLE", 503);
    }

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new AppError(
        typeof payload.detail === "string" ? payload.detail : "Lifecycle vLLM non disponibile.",
        "VLLM_LIFECYCLE_REQUEST_FAILED",
        response.status >= 400 && response.status < 500 ? response.status : 503,
      );
    }

    return {
      configuredMaxModelLen: typeof payload.configured_max_model_len === "number" ? payload.configured_max_model_len : null,
      containerRunning: payload.container_running === true,
      targetContainer: typeof payload.target_container === "string" ? payload.target_container : "birgus_vllm",
    };
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
