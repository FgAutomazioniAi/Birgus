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

export interface BrainywareAgent {
  id: string;
  name: string;
}

export interface BrainywareAgentSession {
  id: string;
}

export interface BrainywareAgentRun {
  reply: string;
  sessionId: string | null;
}

export class BrainywareHttpError extends Error {
  public constructor(
    public readonly statusCode: number,
    message = `Richiesta Brainyware non riuscita (HTTP ${statusCode}).`,
  ) {
    super(message);
    this.name = "BrainywareHttpError";
  }
}

interface BrainywareClientOptions {
  baseUrl?: string;
  accessKey?: string;
  secretKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
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

  public async listAgents(): Promise<BrainywareAgent[]> {
    const payload = await this.request("/brainy/api/ai/agents?page_size=100");
    const record = this.toRecord(payload);
    const rows = Array.isArray(record.rows) ? record.rows : Array.isArray(record.data) ? record.data : Array.isArray(payload) ? payload : [];
    return rows.flatMap((value): BrainywareAgent[] => {
      const row = this.toRecord(value);
      const id = this.firstIdentifier(row.id, row.agent_id, row.agentId);
      const name = this.firstString(row.name, row.label, row.title);
      return id && name ? [{ id, name }] : [];
    });
  }

  public async assertReadOnlyDatabaseConnection(connectionId: string): Promise<void> {
    const connection = (await this.listDatabaseConnections()).find((item) => item.id === connectionId);
    if (!connection) throw new Error("La connessione database Brainyware non e' accessibile al service account.");
    if (connection.accessMode?.toUpperCase() !== "READ_ONLY") {
      throw new Error("Birgus consente esclusivamente connessioni database Brainyware READ_ONLY.");
    }
  }

  public async createAgentSession(agentId: string, sessionName: string): Promise<BrainywareAgentSession> {
    const payload = await this.request(`/brainy/api/ai/agents/${encodeURIComponent(agentId)}/sessions`, {
      method: "POST",
      body: { session_id: "", session_name: sessionName },
    });
    const record = this.toRecord(payload);
    const data = this.toRecord(record.data);
    const session = this.toRecord(record.session);
    const result = this.toRecord(record.result);
    const id = this.firstIdentifier(
      record.session_id,
      record.sessionId,
      record.id,
      data.session_id,
      data.sessionId,
      data.id,
      session.session_id,
      session.sessionId,
      session.id,
      result.session_id,
      result.sessionId,
      result.id,
    );
    if (!id) throw new Error("Brainyware non ha restituito l'identificativo della sessione.");
    return { id };
  }

  public async runAgent(params: { agentId: string; sessionId: string; sessionName?: string; message: string }): Promise<BrainywareAgentRun> {
    const message = params.message.trim();
    if (!message) throw new Error("Messaggio Brainy mancante.");
    const token = await this.authenticate();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/brainy/api/ai/agents/${encodeURIComponent(params.agentId)}/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream", "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: params.sessionId,
          ...(params.sessionId ? {} : { session_name: params.sessionName?.trim() || "Nuova chat" }),
          message,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BrainywareHttpError(
          response.status,
          `Esecuzione agente Brainyware non riuscita (HTTP ${response.status}).`,
        );
      }
      const result = this.extractAgentRun(await response.text());
      if (!result.reply) throw new Error("Brainyware ha risposto senza contenuto testuale.");
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout durante l'esecuzione dell'agente Brainyware.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async *runAgentStream(params: { agentId: string; sessionId: string; sessionName?: string; message: string }): AsyncGenerator<string> {
    const message = params.message.trim();
    if (!message) throw new Error("Messaggio Brainy mancante.");
    const token = await this.authenticate();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/brainy/api/ai/agents/${encodeURIComponent(params.agentId)}/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream", "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: params.sessionId,
          ...(params.sessionId ? {} : { session_name: params.sessionName?.trim() || "Nuova chat" }),
          message,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BrainywareHttpError(response.status, `Esecuzione agente Brainyware non riuscita (HTTP ${response.status}).`);
      }
      if (!response.body) throw new Error("Brainyware non ha aperto uno stream di risposta.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedChunk = false;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) {
          const parsed = this.extractAgentStreamEvent(event, receivedChunk);
          if (!parsed) continue;
          if (parsed.isChunk) receivedChunk = true;
          yield parsed.content;
        }
      }
      if (buffer.trim()) {
        const parsed = this.extractAgentStreamEvent(buffer, receivedChunk);
        if (parsed) yield parsed.content;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout durante l'esecuzione dell'agente Brainyware.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async *runDatabaseStream(params: {
    connectionId: string;
    message: string;
    history: Array<{ role: string; content: string }>;
    includeHistory: boolean;
  }): AsyncGenerator<string> {
    const message = params.message.trim();
    if (!message) throw new Error("Messaggio database Brainy mancante.");
    const token = await this.authenticate();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/brainy/api/database/connections/lf/${encodeURIComponent(params.connectionId)}/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream", "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: params.includeHistory ? params.history : [],
          locale: "italiano",
          instructions: "Rispondi in italiano. Interroga esclusivamente il database configurato.",
          stream: true,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new BrainywareHttpError(response.status, `Interrogazione database Brainyware non riuscita (HTTP ${response.status}).`);
      if (!response.body) throw new Error("Brainyware non ha aperto uno stream di risposta.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedChunk = false;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) {
          const parsed = this.extractGenericStreamEvent(event, receivedChunk);
          if (!parsed) continue;
          if (parsed.isChunk) receivedChunk = true;
          yield parsed.content;
        }
      }
      if (buffer.trim()) {
        const parsed = this.extractGenericStreamEvent(buffer, receivedChunk);
        if (parsed) yield parsed.content;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Timeout durante l'interrogazione del database Brainyware.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  public async searchKnowledge(query: string): Promise<string> {
    const token = await this.authenticate();
    const response = await this.fetchImpl(`${this.baseUrl}/brainy/api/ai/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new BrainywareHttpError(response.status, `Ricerca knowledge Brainyware non riuscita (HTTP ${response.status}).`);
    const contexts = new Set<string>();
    for (const line of (await response.text()).split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      try {
        const value = JSON.parse(line.slice(5).trim()) as unknown;
        const context = this.extractKnowledgeText(value);
        if (context) contexts.add(context);
      } catch {
        // Ignore malformed search fragments.
      }
    }
    return [...contexts].join("\n\n").slice(0, 24_000);
  }

  public async deleteAgentSession(agentId: string, sessionId: string): Promise<void> {
    await this.request(`/brainy/api/ai/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
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
      if (!response.ok) throw new BrainywareHttpError(response.status);
      if (response.status === 204) return {};
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
      if (!response.ok) {
        throw new BrainywareHttpError(
          response.status,
          `Autenticazione Brainyware non riuscita (HTTP ${response.status}).`,
        );
      }
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
      this.toRecord(firstChoice.delta).content,
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

  private extractSseReply(source: string): string {
    const fragments: string[] = [];
    for (const line of source.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const value = line.slice(5).trim();
      if (!value || value === "[DONE]") continue;
      try {
        const fragment = this.extractReply(JSON.parse(value) as unknown);
        if (fragment) fragments.push(fragment);
      } catch {
        fragments.push(value);
      }
    }
    return fragments.join("").trim();
  }

  private extractAgentRun(source: string): BrainywareAgentRun {
    let event = "";
    let sessionId: string | null = null;
    let finalReply = "";
    const chunks: string[] = [];

    for (const line of source.split(/\r?\n/)) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim().toUpperCase();
        continue;
      }
      if (!line.startsWith("data:")) continue;
      try {
        const record = this.toRecord(JSON.parse(line.slice(5).trim()) as unknown);
        sessionId ??= this.firstIdentifier(
          record.session_id,
          record.sessionId,
          this.toRecord(record.session).id,
          this.toRecord(record.data).session_id,
          this.toRecord(record.data).sessionId,
        ) || null;
        const role = this.firstString(record.role, this.toRecord(record.message).role).toLowerCase();
        const content = this.firstString(record.content, this.toRecord(record.message).content);
        if (!content || !["assistant", "agent"].includes(role)) continue;
        if (event === "END" || event === "RESULT") {
          finalReply = content;
        } else if (event === "CHUNK" || !event) {
          chunks.push(content);
        }
      } catch {
        // Ignore malformed SSE fragments and preserve valid assistant chunks.
      }
    }

    return { reply: finalReply || chunks.join(""), sessionId };
  }

  private extractAgentStreamEvent(source: string, receivedChunk: boolean): { content: string; isChunk: boolean } | null {
    const event = source.match(/^event:\s*(.+)$/m)?.[1]?.trim().toUpperCase() ?? "";
    const data = source.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    if (!data) return null;
    try {
      const record = this.toRecord(JSON.parse(data) as unknown);
      const role = this.firstString(record.role, this.toRecord(record.message).role).toLowerCase();
      const message = this.toRecord(record.message);
      const content = typeof record.content === "string" ? record.content : typeof message.content === "string" ? message.content : "";
      if (!content || !["assistant", "agent"].includes(role)) return null;
      if (event === "CHUNK" || !event) return { content, isChunk: true };
      if (!receivedChunk && (event === "END" || event === "RESULT")) return { content, isChunk: false };
    } catch {
      // Ignore malformed SSE fragments and preserve valid assistant chunks.
    }
    return null;
  }

  private extractGenericStreamEvent(source: string, receivedChunk: boolean): { content: string; isChunk: boolean } | null {
    const event = source.match(/^event:\s*(.+)$/m)?.[1]?.trim().toUpperCase() ?? "";
    const data = source.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    if (!data || data === "[DONE]") return null;
    let content = "";
    try {
      content = this.extractReply(JSON.parse(data) as unknown);
    } catch {
      content = data;
    }
    if (!content) return null;
    if (event === "CHUNK" || event === "DELTA" || !event) return { content, isChunk: true };
    if (!receivedChunk && (event === "END" || event === "RESULT" || event === "DONE")) return { content, isChunk: false };
    return null;
  }

  private extractKnowledgeText(value: unknown, depth = 0): string {
    if (depth > 4 || value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map((item) => this.extractKnowledgeText(item, depth + 1)).filter(Boolean).join("\n");
    const record = this.toRecord(value);
    const direct = this.firstString(record.content, record.text, record.excerpt, record.preview, record.chunk, record.page_content);
    if (direct) return direct;
    return [record.results, record.documents, record.data, record.result, record.file].map((item) => this.extractKnowledgeText(item, depth + 1)).filter(Boolean).join("\n");
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
