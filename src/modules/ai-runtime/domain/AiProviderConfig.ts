export interface AiProviderConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embeddingModel: string | null;
  completionsPath: string;
  modelsPath: string;
  timeoutMs: number;
  temperature: number;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toFloat(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadAiProviderConfig(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  const baseUrl = firstNonEmpty(
    overrides.baseUrl,
    process.env.AI_PROVIDER_BASE_URL,
    process.env.ORCH_LM_BASE_URL,
    "http://vllm:8000/v1",
  );
  const apiKey = firstNonEmpty(
    overrides.apiKey,
    process.env.AI_PROVIDER_API_KEY,
    process.env.ORCH_LM_API_KEY,
    process.env.VLLM_API_KEY,
  );
  const chatModel = firstNonEmpty(
    overrides.chatModel,
    process.env.AI_PROVIDER_CHAT_MODEL,
    process.env.ORCH_LM_MODEL,
  );

  return {
    provider: firstNonEmpty(overrides.provider, process.env.AI_PROVIDER, "openai_compatible"),
    baseUrl,
    apiKey,
    chatModel,
    embeddingModel: firstNonEmpty(
      overrides.embeddingModel ?? undefined,
      process.env.AI_PROVIDER_EMBEDDING_MODEL,
      process.env.KNOWLEDGE_EMBEDDING_MODEL,
    ) || null,
    completionsPath: firstNonEmpty(
      overrides.completionsPath,
      process.env.AI_PROVIDER_COMPLETIONS_PATH,
      process.env.ORCH_LM_COMPLETIONS_PATH,
      "/v1/chat/completions",
    ),
    modelsPath: firstNonEmpty(
      overrides.modelsPath,
      process.env.AI_PROVIDER_MODELS_PATH,
      process.env.ORCH_LM_MODELS_PATH,
      "/v1/models",
    ),
    timeoutMs: overrides.timeoutMs ?? toPositiveInt(process.env.AI_PROVIDER_TIMEOUT_MS ?? process.env.ORCH_LM_TIMEOUT_MS, 60000),
    temperature: overrides.temperature ?? toFloat(process.env.AI_PROVIDER_TEMPERATURE ?? process.env.ORCH_LM_TEMPERATURE, 0),
  };
}
