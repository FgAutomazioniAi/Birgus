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
  maxOutputTokens: number;
  topP: number;
  topK: number;
  minP: number;
  repetitionPenalty: number;
  seed: number | null;
  contextTokenLimit: number | null;
}

export const AI_PROVIDER_DEFINITIONS = [
  {
    id: "vllm",
    label: "vLLM",
    protocol: "openai_compatible",
  },
] as const;

export type AiProviderId = (typeof AI_PROVIDER_DEFINITIONS)[number]["id"];

export function normalizeAiProviderId(value: string | undefined): AiProviderId {
  return value === "vllm" ? "vllm" : "vllm";
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

function toInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadAiProviderConfig(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  const baseUrl = firstNonEmpty(
    overrides.baseUrl,
    process.env.AI_PROVIDER_BASE_URL,
    "http://vllm:8000/v1",
  );
  const apiKey = firstNonEmpty(
    overrides.apiKey,
    process.env.AI_PROVIDER_API_KEY,
    process.env.VLLM_API_KEY,
  );
  const chatModel = firstNonEmpty(
    overrides.chatModel,
    process.env.AI_PROVIDER_CHAT_MODEL,
  );

  return {
    provider: normalizeAiProviderId(firstNonEmpty(overrides.provider, process.env.AI_PROVIDER, "vllm")),
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
      "/v1/chat/completions",
    ),
    modelsPath: firstNonEmpty(
      overrides.modelsPath,
      process.env.AI_PROVIDER_MODELS_PATH,
      "/v1/models",
    ),
    timeoutMs: overrides.timeoutMs ?? toPositiveInt(process.env.AI_PROVIDER_TIMEOUT_MS, 60000),
    temperature: overrides.temperature ?? toFloat(process.env.AI_PROVIDER_TEMPERATURE, 0),
    maxOutputTokens: overrides.maxOutputTokens ?? toPositiveInt(process.env.AI_PROVIDER_MAX_OUTPUT_TOKENS, 512),
    topP: overrides.topP ?? toFloat(process.env.AI_PROVIDER_TOP_P, 1),
    topK: overrides.topK ?? toInteger(process.env.AI_PROVIDER_TOP_K, -1),
    minP: overrides.minP ?? toFloat(process.env.AI_PROVIDER_MIN_P, 0),
    repetitionPenalty: overrides.repetitionPenalty ?? toFloat(process.env.AI_PROVIDER_REPETITION_PENALTY, 1),
    seed: overrides.seed ?? null,
    contextTokenLimit: overrides.contextTokenLimit ?? null,
  };
}
