import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { OpenAiCompatibleLmClient } from "../../ai-runtime/services/OpenAiCompatibleLmClient.js";
import { ModuleAgentService } from "../../agents/services/ModuleAgentService.js";
import { BackendPythonModulesClient } from "../../document-intelligence/services/BackendPythonModulesClient.js";
import {
  MeasureReportDocumentType,
  resolveMeasureReportEffectiveDocumentType,
} from "./MeasureReportDocumentTypes.js";

interface PythonPreparedCandidatePayload {
  candidate_id?: unknown;
  candidate_kind?: unknown;
  image_data_url?: unknown;
  page_index?: unknown;
  page_hint?: unknown;
  source_label?: unknown;
}

interface PythonPreparedMeasureReportPayload {
  candidates?: unknown;
  document_type_used?: unknown;
  execution_metadata?: unknown;
  row_format?: unknown;
}

interface PythonEnvelopePayload {
  output?: Record<string, unknown>;
}

interface PreparedCandidate {
  candidateId: string;
  candidateKind: "row" | "page";
  imageDataUrl: string;
  pageIndex: number;
  pageHint: string | null;
  sourceLabel: string | null;
}

interface ParsedRow {
  rowText: string;
  note: string | null;
  pageHint: string | null;
  rawPayload: Record<string, unknown> | null;
}

export interface MeasureReportAnalysisInput {
  documentTypeUsed: Exclude<MeasureReportDocumentType, "auto">;
  promptAgentKey: string;
  summary: string | null;
  rawOutput: string | null;
  rawResponse: Record<string, unknown> | null;
  executionMetadata: Record<string, unknown> | null;
  rows: Array<{
    rowText: string;
    note: string | null;
    pageHint: string | null;
    rawPayload: Record<string, unknown> | null;
  }>;
}

const AGENT_KEY_BY_DOCUMENT_TYPE: Record<Exclude<MeasureReportDocumentType, "auto">, string> = {
  zeiss_1: "measure_report_zeiss_1_prompt",
  zeiss_2: "measure_report_zeiss_2_prompt",
  vicivision: "measure_report_vicivision_prompt",
  dea: "measure_report_dea_prompt",
};

const ROW_FORMAT_BY_DOCUMENT_TYPE: Record<Exclude<MeasureReportDocumentType, "auto">, string> = {
  zeiss_1: "Nome: ... | Measured value: ... | Nominal value: ... | Toll+: ... | Toll-: ... | Deviation: ... | +/-: ...",
  zeiss_2: "Nome: ... | Attuale: ... | Nominale: ... | Toll. Superiore: ... | Toll. Inferiore: ... | Deviazione: ...",
  vicivision: "ID: ... | Nome: ... | Nom: ... | Mis: ... | Oltre Tol: ... | Tol Inf: ... | Tol Sup: ...",
  dea: "Quota: ... | Asse: ... | Nominale: ... | +Tol: ... | -Tol: ... | MIS: ... | DEV: ... | FUORITOL: ...",
};

export class MeasureReportAnalyzer {
  private readonly moduleAgentService: ModuleAgentService;
  private readonly pythonModulesClient: BackendPythonModulesClient;
  private readonly lmClient: OpenAiCompatibleLmClient;

  public constructor(
    moduleAgentService: ModuleAgentService,
    pythonModulesClient?: BackendPythonModulesClient,
    lmClient?: OpenAiCompatibleLmClient,
  ) {
    this.moduleAgentService = moduleAgentService;
    this.pythonModulesClient = pythonModulesClient ?? new BackendPythonModulesClient();
    this.lmClient = lmClient ?? this.buildMeasureReportLmClient();
  }

  public async analyze(params: {
    workspaceId: string;
    fileName: string;
    storagePath: string;
    requestedDocumentType: string | null | undefined;
  }): Promise<MeasureReportAnalysisInput> {
    const effectiveDocumentType = resolveMeasureReportEffectiveDocumentType(
      params.requestedDocumentType,
      params.fileName,
    );
    const promptAgentKey = AGENT_KEY_BY_DOCUMENT_TYPE[effectiveDocumentType];
    const systemPrompt = await this.moduleAgentService.resolveActivePrompt({
      workspaceId: params.workspaceId,
      moduleKey: ModuleKey.MEASURE_REPORT,
      agentKey: promptAgentKey,
    });

    if (!systemPrompt?.trim()) {
      throw new AppError(
        `Prompt agente non configurato per ${promptAgentKey}.`,
        "MEASURE_REPORT_PROMPT_NOT_CONFIGURED",
        503,
      );
    }

    const payload = await this.pythonModulesClient.execute(
      "measure_report_engine",
      "prepare_out_of_tolerance_candidates_storage",
      {
        storage_path: params.storagePath,
        file_name: params.fileName,
        document_type: effectiveDocumentType,
      },
    );

    const prepared = this.normalizePreparedPayload(payload, effectiveDocumentType);
    if (prepared.candidates.length === 0) {
      throw new Error("Preprocessing measure report completato senza immagini candidate.");
    }

    const rawOutputs: string[] = [];
    const rawResponses: Array<Record<string, unknown>> = [];
    const collectedRows: ParsedRow[] = [];
    const candidateErrors: string[] = [];
    const startedAt = Date.now();

    for (const candidate of prepared.candidates) {
      try {
        const lmResult = await this.lmClient.completeMultimodal({
          systemPrompt,
          userText: this.buildCandidateInstruction({
            fileName: params.fileName,
            documentType: prepared.documentTypeUsed,
            rowFormat: prepared.rowFormat,
            candidate,
          }),
          imageUrls: [candidate.imageDataUrl],
          maxTokens: 280,
          temperature: 0,
        });

        rawOutputs.push(this.decorateRawOutput(candidate, lmResult.content));
        rawResponses.push({
          candidate_id: candidate.candidateId,
          candidate_kind: candidate.candidateKind,
          page_index: candidate.pageIndex,
          page_hint: candidate.pageHint,
          source_label: candidate.sourceLabel,
          model: lmResult.model,
          content: lmResult.content,
          response: lmResult.response,
        });

        collectedRows.push(
          ...this.parseOutOfToleranceRows(
            lmResult.content,
            prepared.documentTypeUsed,
            candidate,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Errore AI provider sconosciuto";
        candidateErrors.push(`${candidate.candidateId}: ${message}`);
      }
    }

    if (candidateErrors.length === prepared.candidates.length) {
      throw new Error(`Analisi Measure Report fallita su tutti i candidati: ${candidateErrors.join(" | ")}`);
    }

    const rows = this.dedupeRows(collectedRows);
    const rawOutput = rawOutputs.join("\n\n").trim() || null;

    return {
      documentTypeUsed: prepared.documentTypeUsed,
      promptAgentKey,
      summary: rows.length > 0
        ? `Trovate ${rows.length} righe fuori tolleranza.`
        : "Nessuna riga fuori tolleranza rilevata.",
      rawOutput,
      rawResponse: {
        provider: "openai-compatible-chat-completions-multimodal",
        document_type_used: prepared.documentTypeUsed,
        prompt_agent_key: promptAgentKey,
        responses: rawResponses,
        partial_errors: candidateErrors,
      },
      executionMetadata: {
        ...(prepared.executionMetadata ?? {}),
        candidate_count: prepared.candidates.length,
        processed_candidates: rawResponses.length,
        partial_error_count: candidateErrors.length,
        total_rows: rows.length,
        total_duration_ms: Date.now() - startedAt,
      },
      rows,
    };
  }

  private buildMeasureReportLmClient(): OpenAiCompatibleLmClient {
    const timeoutMs = this.parseOptionalPositiveInt(process.env.MEASURE_REPORT_LM_TIMEOUT_MS);
    const maxOutputTokens = this.parseOptionalPositiveInt(process.env.MEASURE_REPORT_LM_MAX_OUTPUT_TOKENS);
    return new OpenAiCompatibleLmClient({
      baseUrl: this.normalizeLmBaseUrl(process.env.MEASURE_REPORT_LM_BASE_URL ?? process.env.ORCH_LM_BASE_URL),
      requestedModel: process.env.MEASURE_REPORT_LM_MODEL ?? process.env.ORCH_LM_MODEL,
      completionsPath: process.env.MEASURE_REPORT_LM_COMPLETIONS_PATH ?? process.env.ORCH_LM_COMPLETIONS_PATH,
      modelsPath: process.env.MEASURE_REPORT_LM_MODELS_PATH ?? process.env.ORCH_LM_MODELS_PATH,
      timeoutMs: timeoutMs ?? undefined,
      maxOutputTokens: maxOutputTokens ?? undefined,
    });
  }

  private normalizePreparedPayload(
    payload: Record<string, unknown>,
    fallbackType: Exclude<MeasureReportDocumentType, "auto">,
  ): {
    candidates: PreparedCandidate[];
    documentTypeUsed: Exclude<MeasureReportDocumentType, "auto">;
    executionMetadata: Record<string, unknown> | null;
    rowFormat: string;
  } {
    const envelope = payload as PythonEnvelopePayload;
    const response = (envelope.output ?? payload) as PythonPreparedMeasureReportPayload;
    const candidates = Array.isArray(response.candidates)
      ? response.candidates
          .map((candidate, index) => this.normalizeCandidate(candidate as PythonPreparedCandidatePayload, index))
          .filter((candidate): candidate is PreparedCandidate => candidate !== null)
      : [];

    const documentTypeUsed = resolveMeasureReportEffectiveDocumentType(
      typeof response.document_type_used === "string" ? response.document_type_used : fallbackType,
      null,
    );

    return {
      candidates,
      documentTypeUsed,
      executionMetadata: this.toRecord(response.execution_metadata),
      rowFormat: this.toNullableString(response.row_format) ?? ROW_FORMAT_BY_DOCUMENT_TYPE[documentTypeUsed],
    };
  }

  private normalizeCandidate(candidate: PythonPreparedCandidatePayload, index: number): PreparedCandidate | null {
    const imageDataUrl = this.toNullableString(candidate.image_data_url);
    if (!imageDataUrl) {
      return null;
    }

    const candidateKind = this.toNullableString(candidate.candidate_kind) === "page" ? "page" : "row";
    const pageIndex = this.toPositiveInt(candidate.page_index) ?? 1;
    return {
      candidateId: this.toNullableString(candidate.candidate_id) ?? `${candidateKind}-${pageIndex}-${index + 1}`,
      candidateKind,
      imageDataUrl,
      pageIndex,
      pageHint: this.toNullableString(candidate.page_hint),
      sourceLabel: this.toNullableString(candidate.source_label),
    };
  }

  private buildCandidateInstruction(params: {
    fileName: string;
    documentType: Exclude<MeasureReportDocumentType, "auto">;
    rowFormat: string;
    candidate: PreparedCandidate;
  }): string {
    const { candidate, documentType, fileName, rowFormat } = params;
    const pageHint = candidate.pageHint ?? `Pagina ${candidate.pageIndex}`;
    const common = [
      `Documento: ${fileName}.`,
      `${pageHint}.`,
      candidate.candidateKind === "row"
        ? "L'immagine contiene un crop di una o piu righe candidate fuori tolleranza."
        : "L'immagine contiene una pagina intera da ispezionare per trovare eventuali righe fuori tolleranza.",
      `Tipo documento: ${documentType}.`,
      `Rispondi solo con righe nel formato: ${rowFormat}.`,
      "Nessun testo aggiuntivo.",
      "Se non trovi righe fuori tolleranza rispondi esattamente: Nessuna riga trovata.",
    ];

    if (documentType === "vicivision") {
      common.splice(
        4,
        0,
        "Leggi i valori solo nella tabella a destra e ignora totalmente il disegno tecnico a sinistra.",
        "La colonna Nome puo essere spezzata su due righe, ma le colonne numeriche devono contenere solo numeri.",
      );
    }

    if (candidate.candidateKind === "row") {
      common.push("Se nel crop ci sono piu righe fuori tolleranza, restituiscile tutte, una per riga.");
    }

    return common.join(" ");
  }

  private decorateRawOutput(candidate: PreparedCandidate, content: string): string {
    return [
      `### ${candidate.candidateId}`,
      `kind=${candidate.candidateKind} page=${candidate.pageIndex}${candidate.pageHint ? ` hint=${candidate.pageHint}` : ""}`,
      content,
    ].join("\n");
  }

  private parseOutOfToleranceRows(
    rawText: string,
    documentType: Exclude<MeasureReportDocumentType, "auto">,
    candidate: PreparedCandidate,
  ): ParsedRow[] {
    const jsonPayload = this.extractJsonObject(rawText);
    const rowsFromJson = this.parseRowsFromJson(jsonPayload, candidate);
    if (rowsFromJson.length > 0) {
      return this.normalizeRowsForDocumentType(rowsFromJson, documentType);
    }

    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !this.shouldSkipLine(line));

    const deduped = new Set<string>();
    const rows: ParsedRow[] = [];
    for (const line of lines) {
      const normalizedKey = line.replace(/\s+/g, " ").trim().toLowerCase();
      if (deduped.has(normalizedKey)) {
        continue;
      }
      deduped.add(normalizedKey);
      rows.push({
        rowText: line,
        note: null,
        pageHint: candidate.pageHint,
        rawPayload: {
          source: "lm_text",
          candidate_id: candidate.candidateId,
          candidate_kind: candidate.candidateKind,
          page_index: candidate.pageIndex,
          raw_line: line,
        },
      });
    }

    return this.normalizeRowsForDocumentType(rows, documentType);
  }

  private parseRowsFromJson(
    payload: Record<string, unknown> | null,
    candidate: PreparedCandidate,
  ): ParsedRow[] {
    if (!payload) {
      return [];
    }

    const rawRows = Array.isArray(payload.out_of_tolerance_rows)
      ? payload.out_of_tolerance_rows
      : Array.isArray(payload.rows)
        ? payload.rows
        : [];

    return rawRows
      .map((item) => this.normalizeJsonRow(item, candidate))
      .filter((row): row is ParsedRow => row !== null);
  }

  private normalizeJsonRow(item: unknown, candidate: PreparedCandidate): ParsedRow | null {
    if (typeof item === "string") {
      const rowText = item.trim();
      if (!rowText) {
        return null;
      }
      return {
        rowText,
        note: null,
        pageHint: candidate.pageHint,
        rawPayload: {
          source: "lm_json_string",
          candidate_id: candidate.candidateId,
          value: rowText,
        },
      };
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }

    const row = item as Record<string, unknown>;
    const rowText = this.toNullableString(row.row_text)
      ?? this.toNullableString(row.text)
      ?? this.toNullableString(row.line)
      ?? this.toNullableString(row.row);
    if (!rowText) {
      return null;
    }

    return {
      rowText,
      note: this.toNullableString(row.note) ?? this.toNullableString(row.reason) ?? this.toNullableString(row.motivo),
      pageHint: this.toNullableString(row.page_hint) ?? this.toNullableString(row.page) ?? candidate.pageHint,
      rawPayload: {
        source: "lm_json_object",
        candidate_id: candidate.candidateId,
        ...row,
      },
    };
  }

  private normalizeRowsForDocumentType(
    rows: ParsedRow[],
    documentType: Exclude<MeasureReportDocumentType, "auto">,
  ): ParsedRow[] {
    if (documentType !== "dea") {
      return rows;
    }

    return rows.map((row) => {
      const normalized = this.normalizeDeaRowText(row.rowText);
      return normalized === row.rowText ? row : { ...row, rowText: normalized };
    });
  }

  private normalizeDeaRowText(rowText: string): string {
    const pairs = new Map<string, string>();
    for (const chunk of rowText.split("|")) {
      const [rawKey, ...rawValueParts] = chunk.split(":");
      if (!rawKey || rawValueParts.length === 0) {
        continue;
      }
      pairs.set(rawKey.trim(), rawValueParts.join(":").trim());
    }

    const quota = pairs.get("Quota");
    const asse = pairs.get("Asse");
    if (!quota || !asse) {
      return rowText;
    }

    if (this.looksLikeAxisToken(quota) && this.isNumericLike(asse)) {
      pairs.set("Quota", asse);
      pairs.set("Asse", quota);
      const orderedKeys = ["Quota", "Asse", "Nominale", "+Tol", "-Tol", "MIS", "DEV", "FUORITOL"];
      const ordered = orderedKeys
        .filter((key) => pairs.has(key))
        .map((key) => `${key}: ${pairs.get(key)}`);
      for (const [key, value] of pairs.entries()) {
        if (!orderedKeys.includes(key)) {
          ordered.push(`${key}: ${value}`);
        }
      }
      return ordered.join(" | ");
    }

    return rowText;
  }

  private dedupeRows(rows: ParsedRow[]): ParsedRow[] {
    const seen = new Set<string>();
    const deduped: ParsedRow[] = [];
    for (const row of rows) {
      const normalizedKey = row.rowText.replace(/\s+/g, " ").trim().toLowerCase();
      if (!normalizedKey || seen.has(normalizedKey)) {
        continue;
      }
      seen.add(normalizedKey);
      deduped.push(row);
    }
    return deduped;
  }

  private extractJsonObject(text: string): Record<string, unknown> | null {
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] !== "{") {
        continue;
      }

      try {
        const parsed = JSON.parse(text.slice(index));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private shouldSkipLine(line: string): boolean {
    const lowered = line.toLowerCase();
    if (lowered.includes("nessuna riga")) {
      return true;
    }

    return [
      /^```/,
      /^---/,
      /^analisi diretta/,
      /^passo alla modalita/,
      /^errore originale/,
      /^\{/,
      /^\}/,
      /^"/,
    ].some((pattern) => pattern.test(lowered));
  }

  private isNumericLike(value: string): boolean {
    return /^[+-]?\d+(?:[.,]\d+)?$/.test(value.trim().replace(/\s+/g, ""));
  }

  private looksLikeAxisToken(value: string): boolean {
    const token = value.trim().toUpperCase();
    return /^[A-Z]{1,3}$/.test(token) && !this.isNumericLike(token);
  }

  private parseOptionalPositiveInt(value: string | undefined): number | null {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private normalizeLmBaseUrl(value: string | undefined): string | undefined {
    const baseUrl = value?.trim();
    if (!baseUrl) {
      return undefined;
    }

    return baseUrl
      .replace(/\/v1\/chat\/completions\/?$/i, "")
      .replace(/\/api\/v1\/chat\/?$/i, "")
      .replace(/\/api\/v1\/models\/?$/i, "")
      .replace(/\/v1\/?$/i, "");
  }

  private toNullableString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toPositiveInt(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}
