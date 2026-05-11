interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<Record<string, unknown>>;
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ToolCallResponse {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export class LmStudioChatClient {
  private readonly baseUrl: string;
  private readonly completionsPath: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly temperature: number;

  public constructor() {
    this.baseUrl = (process.env.ORCH_LM_BASE_URL ?? "http://host.docker.internal:1234").replace(/\/+$/, "");
    this.completionsPath = this.normalizePath(process.env.ORCH_LM_COMPLETIONS_PATH ?? "/v1/chat/completions");
    this.model = (process.env.ORCH_LM_MODEL ?? "").trim();
    this.timeoutMs = this.toPositiveInt(process.env.ORCH_LM_TIMEOUT_MS, 600000);
    this.temperature = this.toFloat(process.env.ORCH_LM_TEMPERATURE, 0);
  }

  public async chatWithTools(params: {
    messages: ChatMessage[];
    tools: ToolDefinition[];
  }): Promise<{
    model: string;
    content: string | null;
    toolCalls: ToolCallResponse[];
    promptTokens: number | null;
    completionTokens: number | null;
    raw: Record<string, unknown>;
  }> {
    const endpoint = `${this.baseUrl}${this.completionsPath}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        stream: false,
        messages: params.messages,
        tools: params.tools,
        tool_choice: "auto",
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`LM Studio HTTP ${response.status}: ${JSON.stringify(payload)}`);
    }

    const choice = Array.isArray((payload as { choices?: unknown[] }).choices)
      ? (payload as { choices: unknown[] }).choices[0] as Record<string, unknown> | undefined
      : undefined;
    const message = choice?.message && typeof choice.message === "object"
      ? choice.message as Record<string, unknown>
      : undefined;
    const toolCalls = Array.isArray(message?.tool_calls)
      ? message?.tool_calls as ToolCallResponse[]
      : [];
    const usage = payload && typeof payload === "object" ? (payload as { usage?: Record<string, unknown> }).usage : undefined;

    return {
      model: this.model,
      content: typeof message?.content === "string" ? message.content : null,
      toolCalls,
      promptTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
      completionTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null,
      raw: payload as Record<string, unknown>,
    };
  }

  public async chat(params: {
    messages: ChatMessage[];
  }): Promise<{
    model: string;
    content: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    raw: Record<string, unknown>;
  }> {
    const endpoint = `${this.baseUrl}${this.completionsPath}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        stream: false,
        messages: params.messages,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`LM Studio HTTP ${response.status}: ${JSON.stringify(payload)}`);
    }

    const choice = Array.isArray((payload as { choices?: unknown[] }).choices)
      ? (payload as { choices: unknown[] }).choices[0] as Record<string, unknown> | undefined
      : undefined;
    const message = choice?.message && typeof choice.message === "object"
      ? choice.message as Record<string, unknown>
      : undefined;
    const usage = payload && typeof payload === "object" ? (payload as { usage?: Record<string, unknown> }).usage : undefined;

    return {
      model: this.model,
      content: typeof message?.content === "string" ? message.content : null,
      promptTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
      completionTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null,
      raw: payload as Record<string, unknown>,
    };
  }

  private normalizePath(value: string): string {
    return value.startsWith("/") ? value : `/${value}`;
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private toFloat(value: string | undefined, fallback: number): number {
    const parsed = Number.parseFloat(value ?? "");
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
