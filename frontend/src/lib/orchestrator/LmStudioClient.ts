interface LmStudioChatResponseItem {
  type?: string;
  content?: string;
}

export interface LmStudioChatResponse {
  model_instance_id?: string;
  output?: LmStudioChatResponseItem[];
  response_id?: string;
  stats?: Record<string, unknown>;
}

interface LmStudioChatCompletionChoice {
  message?: {
    role?: string;
    content?: string;
  };
  finish_reason?: string | null;
}

export interface LmStudioChatCompletionsResponse {
  id?: string;
  object?: string;
  model?: string;
  choices?: LmStudioChatCompletionChoice[];
  usage?: Record<string, unknown>;
  stats?: Record<string, unknown>;
}

interface LmStudioModelItem {
  id: string;
  type: string;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export class LmStudioClient {
  private readonly baseUrl: string;
  private readonly modelsPath: string;
  private readonly chatPath: string;
  private readonly completionsPath: string;
  private readonly timeoutMs: number;
  private readonly requestedModel: string;
  private readonly maxOutputTokens: number;
  private readonly reasoning: string | null;
  private readonly contextLength: number | null;
  private readonly store: boolean;
  private readonly disablePromptCache: boolean;

  public constructor() {
    this.baseUrl = (process.env.ORCH_LM_BASE_URL ?? "http://host.docker.internal:1234").replace(/\/+$/, "");
    this.modelsPath = normalizePath(process.env.ORCH_LM_MODELS_PATH ?? "/api/v1/models");
    this.chatPath = normalizePath(process.env.ORCH_LM_CHAT_PATH ?? "/api/v1/chat");
    this.completionsPath = normalizePath(process.env.ORCH_LM_COMPLETIONS_PATH ?? "/v1/chat/completions");
    this.timeoutMs = this.parsePositiveInt(process.env.ORCH_LM_TIMEOUT_MS, 60000);
    this.requestedModel = (process.env.ORCH_LM_MODEL ?? "").trim();
    this.maxOutputTokens = this.parsePositiveInt(process.env.ORCH_LM_MAX_OUTPUT_TOKENS, 10000);
    this.reasoning = this.parseReasoning(process.env.ORCH_LM_REASONING);
    this.contextLength = this.parseOptionalPositiveInt(process.env.ORCH_LM_CONTEXT_LENGTH);
    this.store = this.parseBoolean(process.env.ORCH_LM_STORE, false);
    this.disablePromptCache = this.parseBoolean(process.env.ORCH_DDT_DISABLE_PROMPT_CACHE, true);
  }

  public async selectModel(): Promise<string> {
    const available = await this.listModels();
    const availableIds = new Set(available.map((item) => item.id));

    if (this.requestedModel && availableIds.has(this.requestedModel)) {
      return this.requestedModel;
    }

    if (this.requestedModel && available.length === 0) {
      return this.requestedModel;
    }

    if (this.requestedModel && available.length > 0) {
      throw new Error(`Modello LM Studio non disponibile: ${this.requestedModel}`);
    }

    const candidate = available.find((item) => {
      const lowered = item.id.toLowerCase();
      return item.type !== "embedding" && !lowered.includes("embed") && !lowered.includes("embedding");
    });

    if (!candidate) {
      throw new Error("Nessun modello chat disponibile su LM Studio.");
    }

    return candidate.id;
  }

  public async chat(inputText: string): Promise<{ model: string; response: LmStudioChatResponse }> {
    const model = await this.selectModel();
    const temperature = this.parseFloatSafe(process.env.ORCH_LM_TEMPERATURE, 0);

    const requestPayload: Record<string, unknown> = {
      model,
      temperature,
      max_output_tokens: this.maxOutputTokens,
      store: this.store,
      ...(this.contextLength ? { context_length: this.contextLength } : {}),
      input: [
        {
          type: "text",
          content: inputText,
        },
      ],
    };

    if (this.reasoning) {
      requestPayload.reasoning = this.reasoning;
    }

    const chatEndpoint = `${this.baseUrl}${this.chatPath}`;
    this.logLmTraffic("request", chatEndpoint, requestPayload);

    const response = await fetch(chatEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });

    const responsePayload = await response.json().catch(() => ({}));
    this.logLmTraffic("response", chatEndpoint, responsePayload, {
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      throw new Error(`LM Studio HTTP ${response.status}: ${JSON.stringify(responsePayload)}`);
    }

    return {
      model,
      response: responsePayload as LmStudioChatResponse,
    };
  }

  public async completeJsonSchema(options: {
    systemPrompt: string;
    userContext: string;
    schemaName: string;
    schema: Record<string, unknown>;
    maxTokens?: number | null;
    temperature?: number;
  }): Promise<{ model: string; response: LmStudioChatCompletionsResponse; content: string }> {
    const model = await this.selectModel();
    const requestPayload: Record<string, unknown> = {
      model,
      temperature: options.temperature ?? this.parseFloatSafe(process.env.ORCH_LM_TEMPERATURE, 0),
      stream: false,
      messages: [
        {
          role: "system",
          content: options.systemPrompt,
        },
        {
          role: "user",
          content: options.userContext,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          strict: true,
          schema: options.schema,
        },
      },
    };

    if (options.maxTokens && Number.isFinite(options.maxTokens) && options.maxTokens > 0) {
      requestPayload.max_tokens = Math.trunc(options.maxTokens);
    }

    const completionsEndpoint = `${this.baseUrl}${this.completionsPath}`;
    this.logLmTraffic("request", completionsEndpoint, requestPayload);

    const response = await fetch(completionsEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });

    const responsePayload = await response.json().catch(() => ({}));
    this.logLmTraffic("response", completionsEndpoint, responsePayload, {
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      throw new Error(`LM Studio HTTP ${response.status}: ${JSON.stringify(responsePayload)}`);
    }

    const payload = responsePayload as LmStudioChatCompletionsResponse;
    const content = String(payload?.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      throw new Error("LM Studio ha restituito risposta vuota.");
    }

    return {
      model,
      response: payload,
      content,
    };
  }

  private async listModels(): Promise<LmStudioModelItem[]> {
    const timeout = Math.max(5000, Math.min(this.timeoutMs, 30000));
    const response = await fetch(`${this.baseUrl}${this.modelsPath}`, {
      method: "GET",
      signal: AbortSignal.timeout(timeout),
      cache: "no-store",
    }).catch(() => null);

    if (!response || !response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => ({}));
    const items = Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    return items
      .map((item: unknown) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const row = item as Record<string, unknown>;
        const id = String(row.key ?? row.id ?? "").trim();
        const type = String(row.type ?? "").trim().toLowerCase();
        if (!id) {
          return null;
        }

        return { id, type };
      })
      .filter((item: LmStudioModelItem | null): item is LmStudioModelItem => item !== null);
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private parseOptionalPositiveInt(value: string | undefined): number | null {
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  private parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }

    return fallback;
  }

  private parseReasoning(value: string | undefined): string | null {
    const normalized = (value ?? "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (["on", "low", "medium", "high"].includes(normalized)) {
      return normalized;
    }

    return null;
  }

  private parseFloatSafe(value: string | undefined, fallback: number): number {
    const parsed = Number.parseFloat(value ?? "");
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private logLmTraffic(
    direction: "request" | "response",
    endpoint: string,
    payload: unknown,
    meta?: Record<string, unknown>,
  ): void {
    const stamp = new Date().toISOString();
    const head = `[Birgus][LM Studio][${direction.toUpperCase()}] ${stamp} ${endpoint}`;

    if (meta) {
      console.log(head, meta);
      console.log(payload);
      return;
    }

    console.log(head);
    console.log(payload);
  }
}
