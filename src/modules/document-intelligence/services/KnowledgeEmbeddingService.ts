interface EmbeddingResult {
  provider: string;
  model: string | null;
  dimensions: number;
  vector: number[];
  payload: Record<string, unknown> | null;
}

export class KnowledgeEmbeddingService {
  private readonly provider: string;
  private readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly embeddingsPath: string;
  private readonly model: string | null;
  private readonly timeoutMs: number;

  public constructor() {
    this.provider = (process.env.KNOWLEDGE_EMBEDDING_PROVIDER ?? "local-hash").trim().toLowerCase();
    this.dimensions = this.toPositiveInt(process.env.KNOWLEDGE_EMBEDDING_DIMENSIONS, 256);
    this.baseUrl = (process.env.AI_PROVIDER_BASE_URL ?? "http://vllm:8000/v1").replace(/\/+$/, "");
    this.embeddingsPath = this.normalizePath(process.env.KNOWLEDGE_LM_EMBEDDINGS_PATH ?? "/v1/embeddings");
    this.model = (process.env.KNOWLEDGE_EMBEDDING_MODEL ?? "").trim() || null;
    this.timeoutMs = this.toPositiveInt(process.env.AI_PROVIDER_TIMEOUT_MS, 600000);
  }

  public async embed(text: string): Promise<EmbeddingResult> {
    if (["ai_provider", "openai_compatible", "lm_studio"].includes(this.provider) && this.model) {
      try {
        return await this.embedWithAiProvider(text);
      } catch (error) {
        console.warn("[KnowledgeEmbeddingService] AI provider embeddings failed, fallback to local-hash", error);
      }
    }

    return this.embedWithLocalHash(text);
  }

  private async embedWithAiProvider(text: string): Promise<EmbeddingResult> {
    const endpoint = `${this.baseUrl}${this.embeddingsPath}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`AI provider embeddings HTTP ${response.status}`);
    }

    const first = Array.isArray((payload as { data?: unknown[] }).data) ? (payload as { data: unknown[] }).data[0] : null;
    const embedding = first && typeof first === "object" ? (first as { embedding?: unknown }).embedding : null;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("AI provider embeddings response missing vector.");
    }

    const vector = embedding.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    if (vector.length === 0) {
      throw new Error("AI provider embeddings response contained invalid values.");
    }

    return {
      provider: "ai_provider",
      model: this.model,
      dimensions: vector.length,
      vector: this.normalizeVector(vector),
      payload: payload as Record<string, unknown>,
    };
  }

  private embedWithLocalHash(text: string): EmbeddingResult {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9à-ÿ]+/i)
      .map((item) => item.trim())
      .filter((item) => item.length > 1);

    for (const token of tokens) {
      const hash = this.hashToken(token);
      const index = Math.abs(hash % this.dimensions);
      vector[index] += 1;
    }

    return {
      provider: "local-hash",
      model: null,
      dimensions: this.dimensions,
      vector: this.normalizeVector(vector),
      payload: {
        token_count: tokens.length,
      },
    };
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      return vector.map(() => 0);
    }

    return vector.map((value) => value / magnitude);
  }

  private hashToken(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }

  private normalizePath(value: string): string {
    return value.startsWith("/") ? value : `/${value}`;
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
