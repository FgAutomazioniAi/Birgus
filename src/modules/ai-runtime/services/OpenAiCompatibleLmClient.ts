import { loadAiProviderConfig, type AiProviderConfig } from "../domain/AiProviderConfig.js";
import { AiProviderError } from "../domain/AiProviderError.js";
import type { AiChatMessage } from "../domain/AiChatMessage.js";
import type { AiChatCompletionsResponse, AiModelItem } from "../domain/AiChatResponse.js";
import type { AiToolDefinition } from "../domain/AiToolDefinition.js";

interface OpenAiCompatibleClientOptions {
  baseUrl?: string;
  apiKey?: string;
  modelsPath?: string;
  completionsPath?: string;
  timeoutMs?: number;
  requestedModel?: string;
  maxOutputTokens?: number;
  temperature?: number;
  useRuntimeConfig?: boolean;
}

interface LegacyChatResponseItem {
  type?: string;
  content?: string;
}

export interface LegacyChatResponse {
  model_instance_id?: string;
  output?: LegacyChatResponseItem[];
  response_id?: string;
  stats?: Record<string, unknown>;
}

type AiProviderRuntimeConfigResolver = () => Partial<AiProviderConfig> | Promise<Partial<AiProviderConfig>>;

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export class OpenAiCompatibleLmClient {
  private static runtimeConfigResolver: AiProviderRuntimeConfigResolver | null = null;

  private readonly config: AiProviderConfig;
  private readonly maxOutputTokens: number | null;
  private readonly useRuntimeConfig: boolean;

  public constructor(options: OpenAiCompatibleClientOptions = {}) {
    this.config = loadAiProviderConfig({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      modelsPath: options.modelsPath,
      completionsPath: options.completionsPath,
      timeoutMs: options.timeoutMs,
      chatModel: options.requestedModel,
      temperature: options.temperature,
    });
    this.maxOutputTokens = options.maxOutputTokens ?? null;
    this.useRuntimeConfig = options.useRuntimeConfig ?? true;
  }

  public static setRuntimeConfigResolver(resolver: AiProviderRuntimeConfigResolver | null): void {
    OpenAiCompatibleLmClient.runtimeConfigResolver = resolver;
  }

  public async selectModel(): Promise<string> {
    const config = await this.resolveConfig();
    return this.selectModelForConfig(config);
  }

  public async discoverModels(): Promise<AiModelItem[]> {
    const config = await this.resolveConfig();
    return this.listModels(config);
  }

  public async discoverModelsStrict(): Promise<AiModelItem[]> {
    const config = await this.resolveConfig();
    return this.listModels(config, true);
  }

  public async validateConnection(): Promise<{ model: string }> {
    return { model: await this.selectModel() };
  }

  private async selectModelForConfig(config: AiProviderConfig): Promise<string> {
    const requestedModel = config.chatModel.trim();
    const available = await this.listModels(config);
    const availableIds = new Set(available.map((item) => item.id));

    if (requestedModel && availableIds.has(requestedModel)) {
      return requestedModel;
    }

    if (requestedModel && available.length === 0) {
      return requestedModel;
    }

    if (requestedModel && available.length > 0) {
      throw new Error(`Modello AI provider non disponibile: ${requestedModel}`);
    }

    const candidate = available.find((item) => {
      const lowered = item.id.toLowerCase();
      return item.type !== "embedding" && !lowered.includes("embed") && !lowered.includes("embedding");
    });

    if (!candidate) {
      throw new Error("Nessun modello chat disponibile sull'AI provider.");
    }

    return candidate.id;
  }

  public async chat(inputText: string): Promise<{ model: string; response: LegacyChatResponse }> {
    const result = await this.completeMessages({
      messages: [{ role: "user", content: inputText }],
      maxTokens: this.maxOutputTokens,
    });

    return {
      model: result.model,
      response: {
        model_instance_id: result.model,
        output: [{ type: "text", content: result.content }],
        response_id: result.response.id,
        stats: result.response.stats,
      },
    };
  }

  public async completeJsonSchema(options: {
    systemPrompt: string;
    userContext: string;
    schemaName: string;
    schema: Record<string, unknown>;
    maxTokens?: number | null;
    temperature?: number;
  }): Promise<{ model: string; response: AiChatCompletionsResponse; content: string }> {
    return this.completeMessages({
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userContext },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: options.schemaName,
          strict: true,
          schema: options.schema,
        },
      },
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });
  }

  public async completeMultimodal(options: {
    systemPrompt?: string;
    userText: string;
    imageUrls: string[];
    maxTokens?: number | null;
    temperature?: number;
  }): Promise<{ model: string; response: AiChatCompletionsResponse; content: string }> {
    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: options.userText },
      ...options.imageUrls.map((imageUrl) => ({
        type: "image_url",
        image_url: { url: imageUrl },
      })),
    ];

    const messages: AiChatMessage[] = [];
    if ((options.systemPrompt ?? "").trim().length > 0) {
      messages.push({ role: "system", content: options.systemPrompt ?? "" });
    }
    messages.push({ role: "user", content: userContent });

    return this.completeMessages({
      messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });
  }

  public async completeWithTools(options: {
    messages: AiChatMessage[];
    tools: AiToolDefinition[];
    toolChoice?: "auto" | "none" | "required";
    temperature?: number;
  }): Promise<{ model: string; response: AiChatCompletionsResponse; content: string | null; toolCalls: Array<Record<string, unknown>> }> {
    const config = await this.resolveConfig();
    const model = await this.selectModelForConfig(config);
    const requestPayload: Record<string, unknown> = {
      model,
      temperature: options.temperature ?? config.temperature,
      stream: false,
      messages: options.messages,
    };
    this.applyGenerationOptions(requestPayload, config, null);

    if (options.tools.length > 0) {
      requestPayload.tools = options.tools;
      requestPayload.tool_choice = options.toolChoice ?? "auto";
    }

    const payload = await this.postChatCompletions(requestPayload, config);
    const message = payload.choices?.[0]?.message;
    return {
      model,
      response: payload,
      content: typeof message?.content === "string" ? message.content : null,
      toolCalls: Array.isArray(message?.tool_calls) ? message.tool_calls : [],
    };
  }

  private async completeMessages(options: {
    messages: AiChatMessage[];
    responseFormat?: Record<string, unknown>;
    maxTokens?: number | null;
    temperature?: number;
  }): Promise<{ model: string; response: AiChatCompletionsResponse; content: string }> {
    const config = await this.resolveConfig();
    const model = await this.selectModelForConfig(config);
    const requestPayload: Record<string, unknown> = {
      model,
      temperature: options.temperature ?? config.temperature,
      stream: false,
      messages: options.messages,
    };
    this.applyGenerationOptions(requestPayload, config, options.maxTokens ?? this.maxOutputTokens);

    if (options.responseFormat) {
      requestPayload.response_format = options.responseFormat;
    }
    const payload = await this.postChatCompletions(requestPayload, config);
    const content = String(payload?.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      throw new Error("AI provider ha restituito risposta vuota.");
    }

    return { model, response: payload, content };
  }

  private async postChatCompletions(requestPayload: Record<string, unknown>, config: AiProviderConfig): Promise<AiChatCompletionsResponse> {
    const endpoint = this.resolveEndpoint(config, config.completionsPath);
    this.logAiTraffic("request", endpoint, requestPayload);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.buildHeaders(config),
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    }).catch((error: unknown) => {
      if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
        throw new AiProviderError("AI_PROVIDER_TIMEOUT");
      }

      throw new AiProviderError("AI_PROVIDER_NETWORK_UNREACHABLE");
    });

    const responsePayload = await this.readJsonResponse(response, response.ok);
    this.logAiTraffic("response", endpoint, responsePayload, {
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      throw this.toProviderHttpError(response.status);
    }

    return responsePayload as AiChatCompletionsResponse;
  }

  private async listModels(config: AiProviderConfig, strict = false): Promise<AiModelItem[]> {
    const timeout = Math.max(5000, Math.min(config.timeoutMs, 30000));
    const endpoint = this.resolveEndpoint(config, config.modelsPath);
    const response = await fetch(endpoint, {
      method: "GET",
      headers: this.buildHeaders(config),
      signal: AbortSignal.timeout(timeout),
      cache: "no-store",
    }).catch((error: unknown) => {
      if (!strict) {
        return null;
      }
      if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
        throw new AiProviderError("AI_PROVIDER_TIMEOUT");
      }
      throw new AiProviderError("AI_PROVIDER_NETWORK_UNREACHABLE");
    });

    if (!response || !response.ok) {
      if (strict && response) {
        throw this.toProviderHttpError(response.status);
      }
      return [];
    }

    const payload = await this.readJsonResponse(response, strict);
    if (strict && !Array.isArray((payload as { models?: unknown }).models) && !Array.isArray((payload as { data?: unknown }).data)) {
      throw new AiProviderError("AI_PROVIDER_INVALID_RESPONSE");
    }
    const items = Array.isArray((payload as { models?: unknown[] }).models)
      ? (payload as { models: unknown[] }).models
      : Array.isArray((payload as { data?: unknown[] }).data)
        ? (payload as { data: unknown[] }).data
        : [];

    return items
      .map((item: unknown) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const row = item as Record<string, unknown>;
        const id = String(row.key ?? row.id ?? "").trim();
        const type = String(row.type ?? row.object ?? "").trim().toLowerCase();
        if (!id) {
          return null;
        }

        return { id, type };
      })
      .filter((item: AiModelItem | null): item is AiModelItem => item !== null);
  }

  private buildHeaders(config: AiProviderConfig): HeadersInit {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (config.apiKey) {
      headers.authorization = `Bearer ${config.apiKey}`;
    }

    return headers;
  }

  private applyGenerationOptions(requestPayload: Record<string, unknown>, config: AiProviderConfig, maxTokens: number | null): void {
    const outputLimit = maxTokens ?? config.maxOutputTokens;
    if (Number.isFinite(outputLimit) && outputLimit > 0) {
      requestPayload.max_tokens = Math.trunc(outputLimit);
    }
    requestPayload.top_p = config.topP;
    requestPayload.top_k = config.topK;
    requestPayload.min_p = config.minP;
    requestPayload.repetition_penalty = config.repetitionPenalty;
    if (config.seed !== null) {
      requestPayload.seed = config.seed;
    }
    if (config.contextTokenLimit !== null) {
      requestPayload.truncate_prompt_tokens = config.contextTokenLimit;
    }
  }

  private async readJsonResponse(response: Response, strict = true): Promise<Record<string, unknown>> {
    const text = await response.text();
    if (!text.trim()) {
      if (strict) {
        throw new AiProviderError("AI_PROVIDER_INVALID_RESPONSE", response.status);
      }
      return {};
    }

    try {
      const payload = JSON.parse(text) as unknown;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new AiProviderError("AI_PROVIDER_INVALID_RESPONSE", response.status);
      }
      return payload as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      if (strict) {
        throw new AiProviderError("AI_PROVIDER_INVALID_RESPONSE", response.status);
      }
      return {};
    }
  }

  private toProviderHttpError(statusCode: number): AiProviderError {
    if (statusCode === 401) {
      return new AiProviderError("AI_PROVIDER_UNAUTHORIZED", statusCode);
    }
    if (statusCode === 403) {
      return new AiProviderError("AI_PROVIDER_FORBIDDEN", statusCode);
    }
    if (statusCode === 404) {
      return new AiProviderError("AI_PROVIDER_ENDPOINT_NOT_FOUND", statusCode);
    }
    return new AiProviderError("AI_PROVIDER_HTTP_ERROR", statusCode);
  }

  private resolveEndpoint(config: AiProviderConfig, path: string): string {
    const normalizedBaseUrl = config.baseUrl.replace(/\/+$/, "");
    const normalizedPath = normalizePath(path);
    if (normalizedBaseUrl.endsWith("/v1") && normalizedPath.startsWith("/v1/")) {
      return `${normalizedBaseUrl}${normalizedPath.slice(3)}`;
    }
    return `${normalizedBaseUrl}${normalizedPath}`;
  }

  private async resolveConfig(): Promise<AiProviderConfig> {
    if (!this.useRuntimeConfig || !OpenAiCompatibleLmClient.runtimeConfigResolver) {
      return this.config;
    }

    const runtimeConfig = await OpenAiCompatibleLmClient.runtimeConfigResolver();
    return {
      ...this.config,
      ...runtimeConfig,
    };
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

  private logAiTraffic(
    direction: "request" | "response",
    endpoint: string,
    payload: unknown,
    meta?: Record<string, unknown>,
  ): void {
    if (!this.parseBoolean(process.env.LOG_LM_TRAFFIC ?? process.env.LOG_AI_TRAFFIC, false)) {
      return;
    }

    const stamp = new Date().toISOString();
    const head = `[Birgus][AI Provider][${direction.toUpperCase()}] ${stamp} ${endpoint}`;
    const safeMeta = {
      ...(meta ?? {}),
      payload: this.summarizePayload(payload),
    };

    console.log(head, safeMeta);
  }

  private summarizePayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== "object") {
      return { type: typeof payload };
    }

    const row = payload as Record<string, unknown>;
    return {
      type: Array.isArray(payload) ? "array" : "object",
      keys: Object.keys(row).slice(0, 20),
      jsonBytes: JSON.stringify(payload).length,
      messages: Array.isArray(row.messages) ? row.messages.length : undefined,
      choices: Array.isArray(row.choices) ? row.choices.length : undefined,
      outputItems: Array.isArray(row.output) ? row.output.length : undefined,
    };
  }
}
