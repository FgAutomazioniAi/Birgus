import { LmStudioClient } from "./LmStudioClient";
import { PythonModulesClient } from "./PythonModulesClient";
import { DdtWorkflowResult, QuotationWorkflowResult } from "./types";

const FG_CANONICAL = "fg automazioni";
const DEST_FIELDS = ["destinatario", "spettabile", "spett le", "spett.le"];
const MITT_FIELDS = ["mittente", "cedente", "fornitore"];

interface ParsedPayload {
  movement_type?: unknown;
  movement_scope?: unknown;
  main_warehouse_action?: unknown;
  bolla_number?: unknown;
  numero_bolla?: unknown;
  ddt_number?: unknown;
  numero_ddt?: unknown;
  numero_documento?: unknown;
  commessa_reference?: unknown;
  numero_commessa?: unknown;
  commessa?: unknown;
  cantiere_reference?: unknown;
  cantiere?: unknown;
  article_count?: unknown;
  article_items?: unknown;
  analysis_summary?: unknown;
}

type QuotationStructuredData = Record<string, string | null>;

interface PartyEvidence {
  receiver_candidates: string[];
  sender_candidates: string[];
  receiver_has_fg: boolean;
  sender_has_fg: boolean;
}

export class NextLmOrchestrator {
  private readonly pythonModulesClient: PythonModulesClient;
  private readonly lmStudioClient: LmStudioClient;
  private readonly ddtMaxTokens: number | null;
  private readonly useJsonSchema: boolean;

  public constructor() {
    this.pythonModulesClient = new PythonModulesClient();
    this.lmStudioClient = new LmStudioClient();
    this.ddtMaxTokens = this.parseOptionalPositiveInt(process.env.ORCH_DDT_LM_MAX_TOKENS);
    this.useJsonSchema = this.parseBoolean(process.env.ORCH_DDT_USE_JSON_SCHEMA, true);
  }

  public async analyzeFromStorage(input: {
    storagePath: string;
    fileName: string;
    maxPages?: number;
    systemPrompt?: string;
  }): Promise<DdtWorkflowResult> {
    const workflowStartedAt = Date.now();
    const ocrStartedAt = Date.now();
    const ocrResult = await this.pythonModulesClient.execute("ocr_engine", "extract_text_from_pdf_storage", {
      storage_path: input.storagePath,
      max_pages: input.maxPages,
    });
    const ocrDurationMs = Date.now() - ocrStartedAt;

    const extractedText = String(ocrResult.output.extracted_text ?? "").trim();
    if (!extractedText) {
      throw new Error("OCR completato ma testo non rilevato.");
    }

    const fgRule = this.inferMovementByFgRule(extractedText);
    const evidence = this.partyEvidence(extractedText);
    const ocrItems = this.extractArticleItemsFromOcr(extractedText);
    const hasNegativeMarker = this.hasNegativeQuantityMarkerInText(extractedText);

    const userContext = extractedText;
    const systemPrompt = input.systemPrompt?.trim() || this.getPrompt();

    const inferenceStartedAt = Date.now();
    const { parsed, rawResponse, rawProvider } = await this.requestDdtAnalysis({
      systemPrompt,
      userContext,
    });
    const inferenceDurationMs = Date.now() - inferenceStartedAt;

    const normalized = this.normalizePayload(parsed, fgRule, evidence, ocrItems, hasNegativeMarker);
    return {
      ...normalized,
      raw_response: {
        provider: rawProvider,
        response: rawResponse,
        ocr: {
          extracted_chars: ocrResult.output.extracted_chars,
          extracted_pages: ocrResult.output.extracted_pages,
          module: "ocr_engine",
        },
        timings: {
          ocr_ms: ocrDurationMs,
          inference_ms: inferenceDurationMs,
          total_ms: Date.now() - workflowStartedAt,
        },
      },
    };
  }

  public async analyzeQuotationFromStorage(input: {
    storagePath: string;
    fileName: string;
    maxPages?: number;
    systemPrompt?: string;
  }): Promise<QuotationWorkflowResult> {
    const workflowStartedAt = Date.now();
    const ocrStartedAt = Date.now();
    const ocrResult = await this.pythonModulesClient.execute("ocr_engine", "extract_text_from_pdf_storage", {
      storage_path: input.storagePath,
      max_pages: input.maxPages,
    });
    const ocrDurationMs = Date.now() - ocrStartedAt;

    const extractedText = String(ocrResult.output.extracted_text ?? "").trim();
    if (!extractedText) {
      throw new Error("OCR completato ma testo preventivo non rilevato.");
    }

    const cleanedText = this.removeQuotationFooterBlocks(extractedText);
    const systemPrompt = input.systemPrompt?.trim() || this.getQuotationPrompt();

    console.log(
      `[Birgus][NextLmOrchestrator][QUOTATION_LM_REQUEST] chars=${cleanedText.length} file=${input.fileName}`,
    );
    console.log(
      `[Birgus][NextLmOrchestrator][QUOTATION_PROMPT_PREVIEW] ${systemPrompt.slice(0, 500)}`,
    );

    const inferenceStartedAt = Date.now();
    const lmResponse = await this.lmStudioClient.completeJsonSchema({
      systemPrompt,
      userContext: cleanedText,
      schemaName: "quotation_structured_data",
      schema: this.getQuotationSchema(),
      temperature: 0,
    });
    const inferenceDurationMs = Date.now() - inferenceStartedAt;

    const parsed = this.tryParseJsonCandidate(lmResponse.content) as Record<string, unknown>;
    const structuredData = this.normalizeQuotationStructuredData(parsed);

    console.log(
      `[Birgus][NextLmOrchestrator][QUOTATION_LM_RESPONSE] content_chars=${lmResponse.content.length}`,
    );

    return {
      structured_data: structuredData,
      raw_response: {
        provider: "lm-studio-chat-completions-json-schema",
        model: lmResponse.model,
        response: lmResponse.response,
        ocr: {
          extracted_chars: ocrResult.output.extracted_chars,
          extracted_pages: ocrResult.output.extracted_pages,
          module: "ocr_engine",
        },
        timings: {
          ocr_ms: ocrDurationMs,
          inference_ms: inferenceDurationMs,
          total_ms: Date.now() - workflowStartedAt,
        },
      },
    };
  }

  private async requestDdtAnalysis(input: {
    systemPrompt: string;
    userContext: string;
  }): Promise<{
    parsed: ParsedPayload;
    rawResponse: Record<string, unknown>;
    rawProvider: string;
  }> {
    console.log(
      `[Birgus][NextLmOrchestrator][LM_REQUEST] user_context_chars=${input.userContext.length} json_schema=${this.useJsonSchema}`,
    );
    console.log(
      `[Birgus][NextLmOrchestrator][SYSTEM_PROMPT_PREVIEW] ${input.systemPrompt.slice(0, 500)}`,
    );

    if (this.useJsonSchema) {
      const lmResponse = await this.lmStudioClient.completeJsonSchema({
        systemPrompt: input.systemPrompt,
        userContext: input.userContext,
        schemaName: "ddt_analysis",
        schema: this.getDdtSchema(),
        maxTokens: this.ddtMaxTokens,
        temperature: 0,
      });

      const result = {
        parsed: this.tryParseJsonCandidate(lmResponse.content),
        rawResponse: {
          model: lmResponse.model,
          response: lmResponse.response,
        },
        rawProvider: "lm-studio-chat-completions-json-schema",
      };
      console.log(
        `[Birgus][NextLmOrchestrator][LM_RESPONSE] provider=${result.rawProvider} content_chars=${lmResponse.content.length}`,
      );
      return result;
    }

    const lmResponse = await this.lmStudioClient.chat(`${input.systemPrompt}\n\n${input.userContext}`);
    const content = (lmResponse.response.output ?? []).map((item) => item.content ?? "").join("\n").trim();

    const result = {
      parsed: this.tryParseJsonCandidate(content),
      rawResponse: {
        model: lmResponse.model,
        response: lmResponse.response,
      },
      rawProvider: "lm-studio-chat",
    };
    console.log(`[Birgus][NextLmOrchestrator][LM_RESPONSE] provider=${result.rawProvider} content_chars=${content.length}`);
    return result;
  }

  private tryParseJsonCandidate(content: string): ParsedPayload {
    if (!content.trim()) {
      return {};
    }

    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    const candidate = start >= 0 && end > start ? content.slice(start, end + 1) : content;

    try {
      return JSON.parse(candidate) as ParsedPayload;
    } catch {
      return {};
    }
  }

  private normalizePayload(
    parsed: ParsedPayload,
    fgRule: string | null,
    evidence: PartyEvidence,
    ocrItems: Array<{ article_type: string; quantity: number; unit: string }>,
    hasNegativeMarker: boolean,
  ): Omit<DdtWorkflowResult, "raw_response"> {
    const modelMovement = this.normalizeMovementType(parsed.movement_type);
    const movementType = fgRule ?? modelMovement;

    const modelItems = this.extractArticleItemsFromModel(parsed);
    const articleItems = modelItems.length > 0 ? modelItems : ocrItems;
    const internalByFg = evidence.receiver_has_fg && evidence.sender_has_fg;

    const modelScope = this.normalizeMovementScope(parsed.movement_scope);
    const movementScope = internalByFg || hasNegativeMarker
      ? "interno_fg"
      : modelScope !== "sconosciuto"
        ? modelScope
        : evidence.receiver_has_fg || evidence.sender_has_fg
          ? "esterno"
          : "sconosciuto";

    const modelMainAction = this.normalizeMainAction(parsed.main_warehouse_action);
    const mainWarehouseAction = modelMainAction !== "sconosciuto"
      ? modelMainAction
      : movementType === "entrata"
        ? "aggiunta_principale"
        : movementType === "uscita"
          ? "rimozione_principale"
          : movementScope === "interno_fg"
            ? "invariato"
            : "sconosciuto";

    let articleCount = this.toInteger(parsed.article_count);
    if (articleCount === 0) {
      articleCount = articleItems.length;
    }

    const bollaNumber = this.pickFirstNonEmpty(parsed, ["bolla_number", "numero_bolla", "ddt_number", "numero_ddt", "numero_documento"]);
    const commessaReference = this.pickFirstNonEmpty(parsed, ["commessa_reference", "numero_commessa", "commessa", "cantiere_reference", "cantiere"]);

    const transferNote = movementScope === "interno_fg" ? "reso da cantiere" : "";
    const summary = this.composeHumanSummary(
      movementType,
      articleCount,
      movementScope,
      transferNote,
      String(parsed.analysis_summary ?? ""),
    );

    return {
      movement_type: movementType,
      movement_scope: movementScope,
      main_warehouse_action: mainWarehouseAction,
      bolla_number: bollaNumber,
      commessa_reference: commessaReference,
      transfer_note: transferNote,
      article_count: articleCount,
      article_items: articleItems,
      analysis_summary: summary,
    };
  }

  private normalizeMovementType(value: unknown): string {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "entrata" || normalized === "uscita") {
      return normalized;
    }
    return "sconosciuto";
  }

  private normalizeMovementScope(value: unknown): string {
    const normalized = this.normalizeText(String(value ?? ""));
    if (["interno", "interno fg", "interno_fg", "spostamento interno", "internal"].includes(normalized)) {
      return "interno_fg";
    }
    if (["esterno", "external"].includes(normalized)) {
      return "esterno";
    }
    return "sconosciuto";
  }

  private normalizeMainAction(value: unknown): string {
    const normalized = this.normalizeText(String(value ?? ""));
    if (["aggiunta", "aggiunta principale", "aggiunta_principale", "ingresso", "in"].includes(normalized)) {
      return "aggiunta_principale";
    }
    if (["rimozione", "rimozione principale", "rimozione_principale", "uscita", "out"].includes(normalized)) {
      return "rimozione_principale";
    }
    if (["invariato", "nessuna", "nessun impatto"].includes(normalized)) {
      return "invariato";
    }
    return "sconosciuto";
  }

  private hasNegativeQuantityMarkerInText(extractedText: string): boolean {
    return /(^|\s)-\s*\d+(?:[.,]\d+)?(\s|$)/m.test(extractedText);
  }

  private extractArticleItemsFromModel(parsed: ParsedPayload): Array<{ article_type: string; quantity: number; unit: string }> {
    if (!Array.isArray(parsed.article_items)) {
      return [];
    }

    const items: Array<{ article_type: string; quantity: number; unit: string }> = [];
    for (const row of parsed.article_items) {
      if (!row || typeof row !== "object") {
        continue;
      }

      const entry = row as Record<string, unknown>;
      const articleType = String(entry.article_type ?? "").replace(/\s+/g, " ").trim();
      const quantity = this.toFloat(entry.quantity);
      const unit = String(entry.unit ?? "").replace(/\s+/g, " ").trim().toUpperCase();

      if (!articleType || !Number.isFinite(quantity) || quantity === 0 || !unit) {
        continue;
      }

      items.push({
        article_type: articleType.slice(0, 140),
        quantity: Math.abs(quantity),
        unit: unit.slice(0, 20),
      });
    }

    return items;
  }

  private toFloat(value: unknown): number {
    const text = String(value ?? "").trim().replace(/,/g, ".");
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return 0;
    }
    const numeric = Number.parseFloat(match[0]);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private toInteger(value: unknown): number {
    const numeric = Math.abs(Math.trunc(this.toFloat(value)));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private extractArticleItemsFromOcr(extractedText: string): Array<{ article_type: string; quantity: number; unit: string }> {
    const lines = extractedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("[PAGE"));

    const items: Array<{ article_type: string; quantity: number; unit: string }> = [];
    for (let index = 0; index < lines.length - 3; index += 1) {
      const code = lines[index];
      const description = lines[index + 1];
      const unitCandidate = lines[index + 2];
      const quantityCandidate = lines[index + 3];

      if (!this.looksLikeArticleCode(code)) {
        continue;
      }
      if (!this.looksLikeUnit(unitCandidate)) {
        continue;
      }

      const quantity = this.toFloat(quantityCandidate);
      if (!Number.isFinite(quantity) || quantity === 0) {
        continue;
      }

      const cleanDescription = description.replace(/\s+/g, " ").trim();
      if (!cleanDescription) {
        continue;
      }

      items.push({
        article_type: cleanDescription.slice(0, 140),
        quantity: Math.abs(quantity),
        unit: unitCandidate.toUpperCase(),
      });
    }

    return items;
  }

  private looksLikeArticleCode(value: string): boolean {
    return /^[A-Z0-9]{6,}$/.test(value.replace(/\s+/g, ""));
  }

  private looksLikeUnit(value: string): boolean {
    return /^(PZ|NR|N\.|KG|G|L|LT|ML|M|CM|MM|SCAT|BANCALE|CONF)$/i.test(value.trim());
  }

  private pickFirstNonEmpty(payload: ParsedPayload, keys: Array<keyof ParsedPayload>): string {
    for (const key of keys) {
      const value = String(payload[key] ?? "").trim();
      if (value) {
        return value.slice(0, 120);
      }
    }
    return "";
  }

  private composeHumanSummary(
    movementType: string,
    articleCount: number,
    movementScope: string,
    transferNote: string,
    modelSummary: string,
  ): string {
    const cleaned = this.sanitizeSummary(modelSummary);
    const lower = cleaned.toLowerCase();
    const isTechnical = [
      "destinatario",
      "mittente",
      "spettabile",
      "movement_type",
      "movement_scope",
      "article_count",
      "article_items",
      "main_warehouse_action",
    ].some((token) => lower.includes(token));

    if (cleaned && cleaned.length >= 12 && !isTechnical) {
      return cleaned.slice(0, 240);
    }

    if (movementScope === "interno_fg") {
      return `${transferNote || "reso da cantiere"}: movimentati ${articleCount} articoli tra sedi interne FG.`;
    }
    if (movementType === "entrata") {
      return `DDT di entrata: risultano ${articleCount} articoli in ingresso a magazzino.`;
    }
    if (movementType === "uscita") {
      return `DDT di uscita: risultano ${articleCount} articoli in uscita da magazzino.`;
    }

    return `Movimento non determinato con certezza: rilevati ${articleCount} articoli nel documento.`;
  }

  private sanitizeSummary(text: string): string {
    return text
      .trim()
      .replace(/^['"]+|['"]+$/g, "")
      .replace(/\{[^{}]*\}/g, " ")
      .replace(/\[[^\[\]]*\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private inferMovementByFgRule(extractedText: string): string | null {
    const lines = extractedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("[PAGE"));

    const receiverValues = this.extractPartyValues(lines, DEST_FIELDS);
    const senderValues = this.extractPartyValues(lines, MITT_FIELDS);

    if (this.containsFg(receiverValues)) {
      return "entrata";
    }
    if (this.containsFg(senderValues)) {
      return "uscita";
    }

    return null;
  }

  private partyEvidence(extractedText: string): PartyEvidence {
    const lines = extractedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("[PAGE"));

    const receiverValues = this.extractPartyValues(lines, DEST_FIELDS);
    const senderValues = this.extractPartyValues(lines, MITT_FIELDS);

    return {
      receiver_candidates: receiverValues.slice(0, 5),
      sender_candidates: senderValues.slice(0, 5),
      receiver_has_fg: this.containsFg(receiverValues),
      sender_has_fg: this.containsFg(senderValues),
    };
  }

  private extractPartyValues(lines: string[], fieldKeywords: string[]): string[] {
    const normalizedLines = lines.map((line) => this.normalizeText(line));
    const fieldTokens = fieldKeywords.map((item) => this.normalizeText(item));

    const values: string[] = [];

    for (let index = 0; index < normalizedLines.length; index += 1) {
      const normalized = normalizedLines[index];
      if (!fieldTokens.some((token) => normalized.includes(token))) {
        continue;
      }

      const currentOriginal = lines[index].trim();
      const sameLine = currentOriginal.split(/[:\-]/, 2);
      if (sameLine.length === 2) {
        const tail = sameLine[1].trim();
        if (tail) {
          values.push(tail);
        }
      }

      const end = Math.min(lines.length, index + 3);
      for (let pointer = index; pointer < end; pointer += 1) {
        const candidate = lines[pointer].trim();
        if (candidate) {
          values.push(candidate);
        }
      }
    }

    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const value of values) {
      const key = this.normalizeText(value);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(value);
    }

    return deduped;
  }

  private containsFg(values: string[]): boolean {
    return values.some((value) => this.normalizeText(value).includes(FG_CANONICAL));
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private toNullableString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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

  private getDdtSchema(): Record<string, unknown> {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        movement_type: { type: "string", enum: ["entrata", "uscita", "sconosciuto"] },
        movement_scope: { type: "string", enum: ["interno_fg", "esterno", "sconosciuto"] },
        main_warehouse_action: { type: "string", enum: ["aggiunta_principale", "rimozione_principale", "invariato", "sconosciuto"] },
        bolla_number: { type: "string" },
        commessa_reference: { type: "string" },
        article_count: { type: "integer" },
        article_items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              article_type: { type: "string" },
              quantity: { type: "number" },
              unit: { type: "string" },
            },
            required: ["article_type", "quantity", "unit"],
          },
        },
        analysis_summary: { type: "string" },
      },
      required: [
        "movement_type",
        "movement_scope",
        "main_warehouse_action",
        "bolla_number",
        "commessa_reference",
        "article_count",
        "article_items",
        "analysis_summary",
      ],
    };
  }

  private getQuotationSchema(): Record<string, unknown> {
    const nullableString = {
      anyOf: [
        { type: "string" },
        { type: "null" },
      ],
    };

    return {
      type: "object",
      additionalProperties: false,
      properties: {
        Place: nullableString,
        Date: nullableString,
        Attn: nullableString,
        Company: nullableString,
        Address1: nullableString,
        Address2: nullableString,
        Reference: nullableString,
        Greeting: nullableString,
        Title: nullableString,
        "Printing/Press": nullableString,
        Imposition: nullableString,
        "Trim size": nullableString,
        Extent: nullableString,
        Text: nullableString,
        "1st form": nullableString,
        Endpapers: nullableString,
        Casecover: nullableString,
        "Dust jacket": nullableString,
        Binding: nullableString,
        Packing: nullableString,
        Cartons: nullableString,
        Transport: nullableString,
        Prices: nullableString,
        "Extra costs": nullableString,
        ClosingHeaderAttn: nullableString,
        ClosingReference: nullableString,
        ClosingParagraph1: nullableString,
        ClosingParagraph2: nullableString,
        Signoff: nullableString,
        Signature: nullableString,
      },
      required: [
        "Place",
        "Date",
        "Attn",
        "Company",
        "Address1",
        "Address2",
        "Reference",
        "Greeting",
        "Title",
        "Printing/Press",
        "Imposition",
        "Trim size",
        "Extent",
        "Text",
        "1st form",
        "Endpapers",
        "Casecover",
        "Dust jacket",
        "Binding",
        "Packing",
        "Cartons",
        "Transport",
        "Prices",
        "Extra costs",
        "ClosingHeaderAttn",
        "ClosingReference",
        "ClosingParagraph1",
        "ClosingParagraph2",
        "Signoff",
        "Signature",
      ],
    };
  }

  private normalizeQuotationStructuredData(parsed: Record<string, unknown>): QuotationStructuredData {
    const keys = [
      "Place",
      "Date",
      "Attn",
      "Company",
      "Address1",
      "Address2",
      "Reference",
      "Greeting",
      "Title",
      "Printing/Press",
      "Imposition",
      "Trim size",
      "Extent",
      "Text",
      "1st form",
      "Endpapers",
      "Casecover",
      "Dust jacket",
      "Binding",
      "Packing",
      "Cartons",
      "Transport",
      "Prices",
      "Extra costs",
      "ClosingHeaderAttn",
      "ClosingReference",
      "ClosingParagraph1",
      "ClosingParagraph2",
      "Signoff",
      "Signature",
    ] as const;

    return Object.fromEntries(
      keys.map((key) => [key, this.toNullableString(parsed[key])]),
    );
  }

  private removeQuotationFooterBlocks(text: string): string {
    return text.replace(
      /Birgus\s+srl\s+Headquarter[\s\S]*?suzie\.hutton@birgus\.com/gi,
      "",
    ).trim();
  }

  private getQuotationPrompt(): string {
    return `Extract structured data from this quotation letter and return JSON only.
Return only valid JSON, with no markdown, no comments and no extra text.
Each request is independent: do not use memory from previous requests.

Use exactly these keys:
Place, Date, Attn, Company, Address1, Address2, Reference, Greeting,
Title, Printing/Press, Imposition, Trim size, Extent, Text,
1st form, Endpapers, Casecover, Dust jacket, Binding, Packing,
Cartons, Transport, Prices, Extra costs,
ClosingHeaderAttn, ClosingReference,
ClosingParagraph1, ClosingParagraph2,
Signoff, Signature.

Rules:
- Use null when a field is not present.
- Ignore footer/company contact blocks.
- Preserve the original wording from the document.
- Do not translate the content.
- Do not summarize.
- Reference must contain only the reference text, without adding "RE:" if it is not in the document.
- Attn must contain only the recipient line value, without adding "Attn." if it is not in the document.
- ClosingHeaderAttn is the recipient/company line shown again before the closing section on the following page, if present.
- ClosingReference is the repeated RE/reference line shown again before the closing section, if present.
- ClosingParagraph1 is the first closing paragraph.
- ClosingParagraph2 is the second closing paragraph.
- Signoff is the closing formula, such as "Warm regards,".
- Signature is the signer name, such as "Nancy Freeman".
- If a field is spread across multiple OCR lines but clearly belongs to the same value, reconstruct it faithfully as a single string.
- Do not invent values.
- Do not add keys beyond the required schema.`;
  }

  private getPrompt(): string {
    return `Sei un estrattore dati DDT.
Rispondi solo con JSON valido, senza markdown, senza spiegazioni e senza testo extra.
Ogni richiesta e' indipendente: non usare memoria o contesto precedente.

Il tuo compito e' estrarre i dati di testata e TUTTE le righe articolo realmente presenti nel DDT.

Regole vincolanti:
1) Valuta FG Automazioni solo nei campi di testata destinatario/spettabile e mittente/cedente/fornitore.
2) Ignora citazioni di FG Automazioni presenti nelle righe articolo o nelle note.
3) Se FG Automazioni e' destinatario/spettabile, movement_type = "entrata".
4) Altrimenti, se FG Automazioni e' mittente/cedente/fornitore, movement_type = "uscita".
5) Altrimenti, movement_type = "sconosciuto".
6) Se il documento descrive uno spostamento interno tra sedi, reparti o cantieri FG, movement_scope = "interno_fg" e main_warehouse_action = "invariato".
7) Per entrata esterna, main_warehouse_action = "aggiunta_principale".
8) Per uscita esterna, main_warehouse_action = "rimozione_principale".
9) Estrai tutte le righe articolo visibili nella tabella merce.
10) Le righe articolo possono essere presenti anche senza codice articolo.
11) In molti DDT l'OCR produce sequenze come:
    DESCRIZIONE
    UM
    QUANTITA'
    oppure descrizione seguita da unita' e quantita' su righe successive.
    Devi comunque ricostruire TUTTI gli articoli.
12) Non considerare intestazioni o footer come articoli: ad esempio "DESCRIZIONE", "UM", "QUANTITA", "TRASPORTO A CURA", "CAUSALE TRASPORTO", "ANNOTAZIONE".
13) Se trovi il segno "-" davanti alla quantita', restituisci comunque quantity come valore assoluto positivo.

Restituisci solo questi campi:
- movement_type
- movement_scope
- main_warehouse_action
- bolla_number
- commessa_reference
- article_count
- article_items
- analysis_summary

Valori ammessi:
- movement_type: "entrata" | "uscita" | "sconosciuto"
- movement_scope: "interno_fg" | "esterno" | "sconosciuto"
- main_warehouse_action: "aggiunta_principale" | "rimozione_principale" | "invariato" | "sconosciuto"

Fallback obbligatori:
- bolla_number: stringa vuota se assente
- commessa_reference: stringa vuota se assente
- article_count: intero >= 0
- article_items: array JSON; ogni elemento deve avere solo article_type, quantity, unit
- analysis_summary: frase breve e naturale, massimo 20 parole

Non inventare valori. Se un dato non e' presente, usa il fallback richiesto.`;
  }
}
