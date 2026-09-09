import { readFile } from "node:fs/promises";

export type BrainywareInferenceMode = "database" | "model";

export interface BrainywareModel {
  id: string;
}

export interface BrainywareDatabaseConnection {
  id: string;
  name: string;
  dbType: string | null;
  accessMode: string | null;
  trainingState: string | null;
}

export interface BrainywareInferenceResult {
  reply: string;
  mode: BrainywareInferenceMode;
  connectionId?: string;
  model?: string;
  persistentSession: false;
  provider: "brainyware";
}

interface BrainywareClientOptions {
  baseUrl?: string;
  accessKey?: string;
  secretKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  retryAuthentication?: boolean;
}

export class BrainywareClient {
  private readonly baseUrl: string;
  private readonly configuredAccessKey: string | null;
  private readonly configuredSecretKey: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  public constructor(options: BrainywareClientOptions = {}) {
    this.baseUrl = this.normalizeBaseUrl(options.baseUrl ?? process.env.BRAINYWARE_BASE_URL ?? "");
    this.configuredAccessKey = this.cleanSecret(options.accessKey);
    this.configuredSecretKey = this.cleanSecret(options.secretKey);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  public async isConfigured(): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const credentials = await this.readCredentials();
      return Boolean(credentials.accessKey && credentials.secretKey);
    } catch {
      return false;
    }
  }

  public async listModels(): Promise<BrainywareModel[]> {
    const payload = await this.request("/brainy/api/openai/v1/models");
    const record = this.toRecord(payload);
    const rows = Array.isArray(record.data) ? record.data : [];
    const models = rows.flatMap((value): BrainywareModel[] => {
      const id = this.firstString(this.toRecord(value).id);
      return id ? [{ id }] : [];
    });
    const explicitLanguageModels = models.filter((model) => /^llm[-_:]/i.test(model.id));
    if (explicitLanguageModels.length > 0) return explicitLanguageModels;
    return models.filter((model) => !/(^|[-_:])(stt|tts|embedding|rerank)([-_:]|$)/i.test(model.id));
  }

  public async listDatabaseConnections(): Promise<BrainywareDatabaseConnection[]> {
    const payload = await this.request("/brainy/api/database/connections/lf/list");
    const record = this.toRecord(payload);
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(record.rows)
        ? record.rows
        : Array.isArray(record.data)
          ? record.data
          : Array.isArray(record.connections)
            ? record.connections
          : [];
    return rows.flatMap((value): BrainywareDatabaseConnection[] => {
      const row = this.toRecord(value);
      const id = this.firstIdentifier(row.id, row.connection_id, row.connectionId);
      if (!id) return [];
      return [{
        id,
        name: this.firstString(row.name, row.label, row.connection_name) || `Connessione ${id}`,
        dbType: this.firstString(row.db_type, row.dbType, row.type) || null,
        accessMode: this.firstString(row.access_mode, row.accessMode) || null,
        trainingState: this.firstString(row.training_state, row.trainingState, row.status) || null,
      }];
    });
  }

  public async inferStateless(params: {
    message: string;
    mode?: BrainywareInferenceMode;
    connectionId?: string;
    model?: string;
    instructions?: string;
    locale?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<BrainywareInferenceResult> {
    const message = params.message.trim();
    if (!message) throw new Error("Testo mancante per l'inferenza Brainyware.");
    if (message.length > 100_000) throw new Error("Il testo per l'inferenza Brainyware supera 100000 caratteri.");
    const instructions = (params.instructions ?? "").trim();
    if (instructions.length > 4_000) throw new Error("Le istruzioni Brainyware superano 4000 caratteri.");
    const mode = params.mode ?? "database";
    if (mode === "model") {
      return this.completeStateless({ ...params, message, instructions });
    }
    return this.queryDatabaseStateless({ ...params, message, instructions });
  }

  private async queryDatabaseStateless(params: {
    message: string;
    connectionId?: string;
    instructions?: string;
    locale?: string;
  }): Promise<BrainywareInferenceResult> {
    let connectionId = (params.connectionId ?? "").trim();
    if (!connectionId) {
      const connections = await this.listDatabaseConnections();
      if (connections.length === 0) throw new Error("Nessun database Brainyware accessibile al service account.");
      if (connections.length > 1) throw new Error("Selezionare il database Brainyware da interrogare.");
      connectionId = connections[0].id;
    }
    const payload = await this.request(`/brainy/api/database/connections/lf/${encodeURIComponent(connectionId)}/chat`, {
      method: "POST",
      body: {
        message: params.message,
        history: [],
        locale: (params.locale ?? "italiano").trim() || "italiano",
        instructions: params.instructions ?? "",
        stream: false,
      },
    });
    const reply = this.extractReply(payload);
    if (!reply) throw new Error("Brainyware ha risposto senza contenuto testuale.");
    return { reply, mode: "database", connectionId, persistentSession: false, provider: "brainyware" };
  }

  private async completeStateless(params: {
    message: string;
    model?: string;
    instructions?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<BrainywareInferenceResult> {
    let model = (params.model ?? "").trim();
    if (!model) {
      const models = await this.listModels();
      if (models.length === 0) throw new Error("Nessun modello Brainyware accessibile al service account.");
      model = models[0].id;
    }
    const messages = [
      ...(params.instructions ? [{ role: "system", content: params.instructions }] : []),
      { role: "user", content: params.message },
    ];
    const payload = await this.request("/brainy/api/openai/v1/chat/completions", {
      method: "POST",
      body: {
        model,
        messages,
        stream: false,
        temperature: this.clampNumber(params.temperature, 0, 2, 0),
        max_tokens: Math.trunc(this.clampNumber(params.maxTokens, 1, 32_000, 800)),
      },
    });
    const reply = this.extractReply(payload);
    if (!reply) throw new Error("Brainyware ha risposto senza contenuto testuale.");
    return { reply, mode: "model", model, persistentSession: false, provider: "brainyware" };
  }

  private async request(path: string, options: RequestOptions = {}): Promise<unknown> {
    const token = await this.authenticate();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      if (response.status === 401 && options.retryAuthentication !== false) {
        this.token = null;
        this.tokenExpiresAt = 0;
        return this.request(path, { ...options, retryAuthentication: false });
      }
      if (!response.ok) throw new Error(`Richiesta Brainyware non riuscita (HTTP ${response.status}).`);
      return await response.json() as unknown;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout durante la richiesta a Brainyware.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async authenticate(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    if (!this.baseUrl) throw new Error("BRAINYWARE_BASE_URL non configurato.");
    const credentials = await this.readCredentials();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/brainy/api/auth/service`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ access_key: credentials.accessKey, secret_key: credentials.secretKey }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Autenticazione Brainyware non riuscita (HTTP ${response.status}).`);
      const payload = this.toRecord(await response.json() as unknown);
      const token = this.firstString(payload.token, payload.access_token, this.toRecord(payload.data).token, this.toRecord(payload.data).access_token);
      if (!token) throw new Error("Brainyware non ha restituito un token di accesso.");
      this.token = token;
      this.tokenExpiresAt = Date.now() + 7 * 60 * 60 * 1_000;
      return token;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout durante l'autenticazione Brainyware.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readCredentials(): Promise<{ accessKey: string; secretKey: string }> {
    const accessKey = this.configuredAccessKey ?? await this.readSecretFile("BRAINYWARE_ACCESS_KEY_FILE");
    const secretKey = this.configuredSecretKey ?? await this.readSecretFile("BRAINYWARE_SECRET_KEY_FILE");
    if (!accessKey || !secretKey) throw new Error("Credenziali Brainyware non configurate.");
    return { accessKey, secretKey };
  }

  private async readSecretFile(environmentKey: string): Promise<string> {
    const path = process.env[environmentKey]?.trim();
    if (!path) return "";
    try {
      return this.cleanSecret(await readFile(path, "utf8")) ?? "";
    } catch {
      return "";
    }
  }

  private extractReply(value: unknown, depth = 0): string {
    if (depth > 4) return "";
    if (typeof value === "string") return value.trim();
    const record = this.toRecord(value);
    const choices = Array.isArray(record.choices) ? record.choices : [];
    const firstChoice = this.toRecord(choices[0]);
    const direct = this.firstString(
      this.toRecord(firstChoice.message).content,
      firstChoice.text,
      record.reply,
      record.answer,
      record.content,
      record.text,
      record.result,
      this.toRecord(record.message).content,
    );
    if (direct) return direct;
    for (const nested of [record.data, record.output, record.response]) {
      const reply = this.extractReply(nested, depth + 1);
      if (reply) return reply;
    }
    return "";
  }

  private normalizeBaseUrl(value: string): string {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("BRAINYWARE_BASE_URL deve usare HTTP o HTTPS.");
    return parsed.toString().replace(/\/$/, "");
  }

  private cleanSecret(value: string | undefined): string | null {
    const cleaned = value?.trim() ?? "";
    return cleaned && cleaned !== "UNCONFIGURED" ? cleaned : null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private firstString(...values: unknown[]): string {
    for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
    return "";
  }

  private firstIdentifier(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
  }

  private clampNumber(value: number | undefined, minimum: number, maximum: number, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
  }
}
