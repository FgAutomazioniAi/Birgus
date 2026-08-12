import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { GaragePath } from "../../../storage/GaragePath.js";
import { ProjectBinaryStorage } from "../../../storage/ProjectBinaryStorage.js";
import { OpenAiCompatibleLmClient } from "../../ai-runtime/services/OpenAiCompatibleLmClient.js";
import {
  ddtAnalysisJsonSchema,
  parseDdtAnalysisModelPayload,
  type DdtAnalysisModelPayload,
} from "../domain/DdtAnalysisModelSchema.js";
import { DdtAnalysisInput } from "../repositories/DdtProcessingRepository.js";
import { DdtAnalyzer } from "./DdtAnalyzer.js";

export class LmStudioDdtAnalyzer implements DdtAnalyzer {
  private readonly objectStorage: ProjectBinaryStorage;
  private readonly lmClient: OpenAiCompatibleLmClient;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxPdfTextChars: number;

  public constructor(storage: ProjectBinaryStorage, lmClient?: OpenAiCompatibleLmClient) {
    this.objectStorage = storage;
    this.model = process.env.DDT_READER_LM_MODEL ?? process.env.AI_PROVIDER_CHAT_MODEL ?? process.env.ORCH_LM_MODEL ?? "";
    this.timeoutMs = this.toPositiveInt(process.env.DDT_READER_LM_TIMEOUT_MS ?? process.env.AI_PROVIDER_TIMEOUT_MS, 45000);
    this.maxPdfTextChars = this.toPositiveInt(process.env.DDT_READER_LM_MAX_PDF_TEXT_CHARS, 20000);
    this.lmClient = lmClient ?? new OpenAiCompatibleLmClient({
      baseUrl: process.env.DDT_READER_LM_BASE_URL ?? process.env.AI_PROVIDER_BASE_URL ?? process.env.ORCH_LM_BASE_URL,
      apiKey: process.env.DDT_READER_LM_API_KEY ?? process.env.AI_PROVIDER_API_KEY ?? process.env.VLLM_API_KEY,
      requestedModel: this.model,
      completionsPath: process.env.DDT_READER_LM_COMPLETIONS_PATH ?? process.env.AI_PROVIDER_COMPLETIONS_PATH ?? process.env.ORCH_LM_COMPLETIONS_PATH,
      modelsPath: process.env.DDT_READER_LM_MODELS_PATH ?? process.env.AI_PROVIDER_MODELS_PATH ?? process.env.ORCH_LM_MODELS_PATH,
      timeoutMs: this.timeoutMs,
    });
  }

  public async analyze(ddtDocumentId: string): Promise<DdtAnalysisInput> {
    if (!this.model.trim()) {
      throw new Error("DDT_READER_LM_MODEL mancante.");
    }

    const row = await this.loadDdtDocument(ddtDocumentId);
    const pdfBytes = await this.loadDocumentBytes(row.storage_path);
    const extractedText = this.extractTextFromPdf(pdfBytes).slice(0, this.maxPdfTextChars);
    const prompt = this.buildPrompt(extractedText, row.original_filename ?? row.filename ?? "document.pdf");

    const responsePayload = await this.callAiProvider(prompt);
    const parsed = this.parseProviderJson(responsePayload.content);
    const normalized = this.normalizeAnalysis(parsed);

    return {
      ...normalized,
      rawResponse: {
        provider: "openai-compatible-chat-completions-json-schema",
        model: responsePayload.model,
        documentId: ddtDocumentId,
        response: responsePayload.response,
      },
    };
  }

  private async loadDdtDocument(ddtDocumentId: string): Promise<{ filename: string | null; original_filename: string | null; storage_path: string }> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.ddtDocument.findUnique({
      where: { id: ddtDocumentId },
      select: {
        original_filename: true,
        document: {
          select: {
            filename: true,
            storage_path: true,
          },
        },
      },
    });

    if (!row?.document?.storage_path) {
      throw new Error(`Documento DDT ${ddtDocumentId} non trovato o senza storage_path.`);
    }

    return {
      filename: row.document.filename,
      original_filename: row.original_filename,
      storage_path: row.document.storage_path,
    };
  }

  private async loadDocumentBytes(storagePath: string): Promise<Buffer> {
    const parsed = GaragePath.parse(storagePath);
    const object = await this.objectStorage.getObject(parsed.bucket, parsed.objectKey);
    return object.bytes;
  }

  private extractTextFromPdf(bytes: Buffer): string {
    const source = bytes.toString("latin1");
    const chunks: string[] = [];

    const textOps = [...source.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)];
    for (const op of textOps) {
      const literal = op[0].replace(/\s*Tj$/, "");
      chunks.push(this.decodePdfLiteralString(literal));
    }

    const arrayOps = [...source.matchAll(/\[(.*?)\]\s*TJ/gs)];
    for (const op of arrayOps) {
      const literalMatches = op[1].match(/\((?:\\.|[^\\)])*\)/g) ?? [];
      for (const literal of literalMatches) {
        chunks.push(this.decodePdfLiteralString(literal));
      }
    }

    if (chunks.length === 0) {
      const fallback = source
        .replace(/[^\x20-\x7E\n\r\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return fallback;
    }

    return chunks
      .join("\n")
      .replace(/\s+/g, " ")
      .trim();
  }

  private decodePdfLiteralString(literal: string): string {
    const body = literal.startsWith("(") && literal.endsWith(")") ? literal.slice(1, -1) : literal;
    let out = "";

    for (let index = 0; index < body.length; index += 1) {
      const current = body[index];
      if (current !== "\\") {
        out += current;
        continue;
      }

      const next = body[index + 1] ?? "";
      if (/[0-7]/.test(next)) {
        const oct = body.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? "";
        if (oct) {
          out += String.fromCharCode(Number.parseInt(oct, 8));
          index += oct.length;
          continue;
        }
      }

      const escaped = this.decodeEscapedPdfChar(next);
      out += escaped.char;
      index += escaped.consumed;
    }

    return out;
  }

  private decodeEscapedPdfChar(value: string): { char: string; consumed: number } {
    switch (value) {
      case "n":
        return { char: "\n", consumed: 1 };
      case "r":
        return { char: "\r", consumed: 1 };
      case "t":
        return { char: "\t", consumed: 1 };
      case "b":
        return { char: "\b", consumed: 1 };
      case "f":
        return { char: "\f", consumed: 1 };
      case "(":
      case ")":
      case "\\":
        return { char: value, consumed: 1 };
      case "\r":
      case "\n":
        return { char: "", consumed: 1 };
      default:
        return { char: value, consumed: 1 };
    }
  }

  private buildPrompt(extractedText: string, fileName: string): string {
    const safeText = extractedText.trim().length > 0 ? extractedText : "(nessun testo PDF estraibile)";
    const analysisPrompt = `Sei un estrattore di dati DDT.
        Devi distinguere con massima accuratezza se FG Automazioni e' mittente o destinatario/spettabile.
        Considera solo i campi di testata: destinatario/spettabile e mittente/cedente/fornitore.
        Non usare citazioni di FG Automazioni presenti nelle righe articolo o in note testuali.

        Regola vincolante:
        1) se FG Automazioni e' in destinatario o spettabile => movement_type=entrata;
        2) altrimenti, se FG Automazioni e' in mittente/cedente/fornitore => movement_type=uscita;
        3) altrimenti => movement_type=sconosciuto.
        4) il segno "-" davanti alla quantita' NON indica valore negativo:
           indica spostamento interno tra reparti/sedi/cantieri di FG Automazioni.

        Per article_items usa SOLO: article_type, quantity, unit.
        L'unita' di misura (unit) deve essere dedotta dal contesto del DDT e riportata nel formato piu' fedele possibile.
        Esempi possibili: PZ, KG, G, L, ML, M, CM, SCAT, BANCALE.
        Non convertire quantita' o unita' e non normalizzare i valori.
        Non inserire l'unita' dentro article_type.

        Se compare il segno "-", interpreta la quantita' come valore assoluto movimentato internamente.
        Quindi quantity deve essere >= 0.

        Rispondi SOLO in JSON valido con chiavi:
        movement_type, movement_scope, main_warehouse_action, bolla_number, commessa_reference,
        transfer_note, article_count, article_items, analysis_summary.

        movement_type deve essere: entrata, uscita, sconosciuto.
        movement_scope deve essere: interno_fg, esterno, sconosciuto.
        main_warehouse_action deve essere: aggiunta_principale, rimozione_principale, invariato, sconosciuto.
        Se movement_scope=interno_fg, transfer_note deve essere esattamente "reso da cantiere".
        Altrimenti transfer_note deve essere stringa vuota.

        bolla_number: numero bolla/DDT se presente, altrimenti stringa vuota.
        commessa_reference: riferimento commessa/cantiere se presente, altrimenti stringa vuota.
        article_count deve essere intero >= 0.

        article_items deve essere array JSON.
        Ogni elemento deve contenere solo:
        article_type (string), quantity (numero), unit (string).

        analysis_summary deve essere una frase breve naturale (max 20 parole).`;

    return `${analysisPrompt}\n\nFILE: ${fileName}\n\nTESTO_DDT:\n${safeText}`;
  }

  private async callAiProvider(prompt: string): Promise<{
    model: string;
    content: string;
    response: Record<string, unknown>;
  }> {
    this.logAiTraffic("request", { model: this.model, promptChars: prompt.length });
    const responsePayload = await this.lmClient.completeJsonSchema({
      systemPrompt: "Estrai dati DDT e rispondi solo con JSON valido conforme allo schema.",
      userContext: prompt,
      schemaName: "ddt_analysis",
      schema: ddtAnalysisJsonSchema,
      maxTokens: this.toPositiveInt(process.env.ORCH_DDT_LM_MAX_TOKENS, 700),
      temperature: 0,
    });
    this.logAiTraffic("response", {
      model: responsePayload.model,
      contentChars: responsePayload.content.length,
    });

    return {
      model: responsePayload.model,
      content: responsePayload.content,
      response: responsePayload.response as Record<string, unknown>,
    };
  }

  private logAiTraffic(direction: "request" | "response", meta: Record<string, unknown>): void {
    const enabled = ["1", "true", "yes", "on"].includes((process.env.LOG_LM_TRAFFIC ?? "").trim().toLowerCase());
    if (!enabled) {
      return;
    }

    console.log(`[Birgus][DDT AI Provider][${direction.toUpperCase()}] ${new Date().toISOString()}`, meta);
  }

  private parseProviderJson(content: string): DdtAnalysisModelPayload {
    if (!content) {
      throw new Error("AI provider ha restituito output vuoto.");
    }

    return parseDdtAnalysisModelPayload(content);
  }

  private normalizeAnalysis(payload: DdtAnalysisModelPayload): DdtAnalysisInput {
    const articleItems = payload.article_items.map((item) => ({
      articleType: this.toStringOrDefault(item.article_type, "sconosciuto"),
      quantity: this.toNumber(item.quantity),
      unit: this.toStringOrDefault(item.unit, "pz"),
    }));

    return {
      movementType: this.toNullableString(payload.movement_type),
      movementScope: this.toNullableString(payload.movement_scope),
      mainWarehouseAction: this.toNullableString(payload.main_warehouse_action),
      bollaNumber: this.toNullableString(payload.bolla_number),
      commessaReference: this.toNullableString(payload.commessa_reference),
      transferNote: this.toNullableString(payload.transfer_note),
      articleCount: payload.article_count,
      warehouseDelta: this.computeWarehouseDelta(payload.main_warehouse_action, payload.article_count),
      summary: this.toNullableString(payload.analysis_summary),
      rawResponse: payload as Record<string, unknown>,
      articleItems,
    };
  }

  private computeWarehouseDelta(mainAction: string, articleCount: number): number {
    if (mainAction === "aggiunta_principale") {
      return articleCount;
    }
    if (mainAction === "rimozione_principale") {
      return -articleCount;
    }
    return 0;
  }

  private toNullableString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toStringOrDefault(value: unknown, fallback: string): string {
    const normalized = this.toNullableString(value);
    return normalized ?? fallback;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
