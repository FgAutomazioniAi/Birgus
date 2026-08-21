import { createHash } from "node:crypto";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { FileKind } from "../../document-archive/domain/FileKind.js";
import { DocumentArchiveService } from "../../document-archive/services/DocumentArchiveService.js";
import { KnowledgeDocumentEntity } from "../domain/KnowledgeDocumentEntity.js";
import { KnowledgeSearchHitEntity } from "../domain/KnowledgeSearchHitEntity.js";
import { DEFAULT_KNOWLEDGE_MODE, normalizeKnowledgeMode, type KnowledgeMode } from "../domain/KnowledgeMode.js";
import { PrismaKnowledgeRepository } from "../infra/PrismaKnowledgeRepository.js";
import { KnowledgeRepository, SourceDocumentRecord } from "../repositories/KnowledgeRepository.js";
import { BackendPythonModulesClient } from "./BackendPythonModulesClient.js";
import { KnowledgeEmbeddingService } from "./KnowledgeEmbeddingService.js";

export interface DocumentChatContext {
  kind: "document" | "ddt_document";
  documentId: string;
  ddtDocumentId: string | null;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string | null;
  sourceLabel: string | null;
  summaryText: string | null;
  contentPreview: string | null;
  structuredPayload: Record<string, unknown> | null;
  ddtAnalysis: Record<string, unknown> | null;
}

export class DocumentIntelligenceService {
  private readonly repository: KnowledgeRepository;
  private readonly documentArchiveService: DocumentArchiveService;
  private readonly pythonModulesClient: BackendPythonModulesClient;
  private readonly embeddingService: KnowledgeEmbeddingService;
  private readonly defaultTopK: number;

  public constructor(
    documentArchiveService: DocumentArchiveService,
    repository?: KnowledgeRepository,
    pythonModulesClient?: BackendPythonModulesClient,
    embeddingService?: KnowledgeEmbeddingService,
  ) {
    this.documentArchiveService = documentArchiveService;
    this.repository = repository ?? new PrismaKnowledgeRepository();
    this.pythonModulesClient = pythonModulesClient ?? new BackendPythonModulesClient();
    this.embeddingService = embeddingService ?? new KnowledgeEmbeddingService();
    this.defaultTopK = this.toPositiveInt(process.env.KNOWLEDGE_SEARCH_TOP_K, 5);
  }

  public async refreshDocumentKnowledge(workspaceId: string, documentId: string): Promise<KnowledgeDocumentEntity> {
    const source = await this.loadNormalizedSourceDocument(workspaceId, documentId);
    if (!source) {
      throw new AppError("Documento sorgente non trovato.", "KNOWLEDGE_SOURCE_NOT_FOUND", 404);
    }

    const extracted = await this.extractDocumentText(source);
    const contentHash = this.sha256(extracted.text);
    const summaryText = this.buildSummary(extracted.text);

    const knowledgeDocument = await this.repository.upsertKnowledgeDocument({
      workspaceId,
      documentId: source.id,
      moduleId: source.moduleId,
      sourceEntityType: source.domainEntityType ?? "document",
      sourceEntityId: source.domainEntityId ?? source.id,
      representationKey: extracted.representationKey,
      title: source.filename,
      sourceLabel: source.nodePath,
      contentText: extracted.text,
      summaryText,
      structuredPayload: extracted.payload,
      extractionStatus: "READY",
      extractionKind: extracted.extractionKind,
      contentHash,
      lastError: null,
      extractedAt: new Date(),
    });

    const chunks = await this.buildChunkModels(extracted.text);
    await this.repository.replaceKnowledgeChunks(workspaceId, knowledgeDocument.id, chunks);
    return knowledgeDocument;
  }

  public async getOrRefreshKnowledgeDocument(workspaceId: string, documentId: string): Promise<KnowledgeDocumentEntity> {
    const source = await this.loadNormalizedSourceDocument(workspaceId, documentId);
    if (!source) {
      throw new AppError("Documento sorgente non trovato.", "KNOWLEDGE_SOURCE_NOT_FOUND", 404);
    }
    return this.ensureDocumentKnowledge(source);
  }

  public async analyzeDocumentSet(params: {
    workspaceId: string;
    documentIds: string[];
    prompt: string;
    knowledgeMode?: KnowledgeMode;
    useDeepReasoning?: boolean;
    aiProvider?: Record<string, unknown> | null;
  }): Promise<Record<string, unknown>> {
    const knowledgeMode = normalizeKnowledgeMode(params.knowledgeMode, DEFAULT_KNOWLEDGE_MODE);
    const documentIds = Array.from(new Set(params.documentIds.map((id) => id.trim()).filter(Boolean)));
    if (documentIds.length === 0) {
      throw new AppError("Seleziona almeno un documento.", "DOCUMENT_SET_EMPTY", 400);
    }
    if (documentIds.length > 20) {
      throw new AppError("Puoi analizzare al massimo 20 documenti alla volta.", "DOCUMENT_SET_TOO_LARGE", 400);
    }

    const documents = [];
    for (const documentId of documentIds) {
      const knowledge = await this.resolveKnowledgeDocumentForMode(params.workspaceId, documentId, knowledgeMode);
      documents.push({
        documentId,
        knowledgeDocumentId: knowledge.id,
        title: knowledge.title ?? documentId,
        sourceLabel: knowledge.sourceLabel,
        summaryText: knowledge.summaryText,
        contentText: knowledge.contentText ?? "",
        extractionKind: knowledge.extractionKind,
      });
    }

    const prompt = params.prompt.trim() || "Riassumi i documenti, evidenziando punti principali, differenze e azioni suggerite.";
    const inputText = this.buildDocumentSetPrompt(prompt, documents);
    const response = await this.pythonModulesClient.execute("langchain_orchestrator", "chat", {
      instructions: (
        "Sei un assistente documentale. Rispondi in italiano. "
        + "Usa solo le informazioni presenti nei documenti forniti; se manca un dato, dichiaralo."
      ),
      input_text: inputText,
      use_deep_reasoning: params.useDeepReasoning === true,
      ai_provider: params.aiProvider ?? null,
      max_tokens: params.useDeepReasoning ? 2048 : 1200,
      temperature: 0.2,
    });
    const output = response.output && typeof response.output === "object"
      ? response.output as Record<string, unknown>
      : {};

    return {
      reply: typeof output.reply === "string" ? output.reply : "",
      reasoning_structure: output.reasoning_structure ?? null,
      model: output.model ?? null,
      documents: documents.map((document) => ({
        documentId: document.documentId,
        knowledgeDocumentId: document.knowledgeDocumentId,
        title: document.title,
        sourceLabel: document.sourceLabel,
        summaryText: document.summaryText,
        extractionKind: document.extractionKind,
      })),
      contextPolicy: {
        knowledgeMode,
      },
    };
  }

  public async getDocumentChatContext(params: {
    workspaceId: string;
    documentId: string;
  }): Promise<DocumentChatContext> {
    const source = await this.loadNormalizedSourceDocument(params.workspaceId, params.documentId);
    if (!source) {
      throw new AppError("Documento sorgente non trovato.", "KNOWLEDGE_SOURCE_NOT_FOUND", 404);
    }

    const knowledge = await this.ensureDocumentKnowledge(source);
    return {
      kind: "document",
      documentId: source.id,
      ddtDocumentId: null,
      sourceEntityType: knowledge.sourceEntityType,
      sourceEntityId: knowledge.sourceEntityId,
      title: knowledge.title ?? source.filename,
      sourceLabel: knowledge.sourceLabel ?? source.nodePath,
      summaryText: knowledge.summaryText,
      contentPreview: this.buildPreviewText(knowledge.contentText),
      structuredPayload: knowledge.structuredPayload,
      ddtAnalysis: null,
    };
  }

  public async getDocumentChatContextForMode(params: {
    workspaceId: string;
    documentId: string;
    knowledgeMode?: KnowledgeMode;
  }): Promise<DocumentChatContext> {
    const source = await this.loadNormalizedSourceDocument(params.workspaceId, params.documentId);
    if (!source) {
      throw new AppError("Documento sorgente non trovato.", "KNOWLEDGE_SOURCE_NOT_FOUND", 404);
    }

    const knowledgeMode = normalizeKnowledgeMode(params.knowledgeMode, DEFAULT_KNOWLEDGE_MODE);
    const knowledge = knowledgeMode === "on_demand"
      ? await this.refreshDocumentKnowledge(params.workspaceId, source.id)
      : await this.resolveKnowledgeDocumentForMode(params.workspaceId, source.id, knowledgeMode);

    return {
      kind: "document",
      documentId: source.id,
      ddtDocumentId: null,
      sourceEntityType: knowledge.sourceEntityType,
      sourceEntityId: knowledge.sourceEntityId,
      title: knowledge.title ?? source.filename,
      sourceLabel: knowledge.sourceLabel ?? source.nodePath,
      summaryText: knowledge.summaryText,
      contentPreview: this.buildPreviewText(knowledge.contentText),
      structuredPayload: knowledge.structuredPayload,
      ddtAnalysis: null,
    };
  }

  public async getDdtDocumentChatContext(params: {
    workspaceId: string;
    ddtDocumentId: string;
  }): Promise<DocumentChatContext> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.ddtDocument.findFirst({
      where: {
        id: params.ddtDocumentId,
        workspace_id: params.workspaceId,
      },
      include: {
        document: {
          select: {
            id: true,
          },
        },
        analysis_result: {
          include: {
            article_items: {
              orderBy: {
                id: "asc",
              },
            },
          },
        },
      },
    });

    if (!row?.document?.id) {
      throw new AppError("Documento DDT non trovato.", "DDT_DOCUMENT_NOT_FOUND", 404);
    }

    const baseContext = await this.getDocumentChatContext({
      workspaceId: params.workspaceId,
      documentId: row.document.id,
    });

    return {
      ...baseContext,
      kind: "ddt_document",
      ddtDocumentId: row.id,
      ddtAnalysis: row.analysis_result
        ? {
            movementType: row.analysis_result.movement_type,
            movementScope: row.analysis_result.movement_scope,
            mainWarehouseAction: row.analysis_result.main_warehouse_action,
            bollaNumber: row.analysis_result.bolla_number,
            commessaReference: row.analysis_result.commessa_reference,
            transferNote: row.analysis_result.transfer_note,
            articleCount: row.analysis_result.article_count,
            warehouseDelta: row.analysis_result.warehouse_delta,
            summary: row.analysis_result.summary,
            articleItems: row.analysis_result.article_items.map((item) => ({
              articleType: item.article_type,
              quantity: Number(item.quantity),
              unit: item.unit,
            })),
          }
        : null,
    };
  }

  public async getProjectVersionQuotationContext(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
  }): Promise<{
    documentId: string;
    fileName: string | null;
    storagePath: string;
    summaryText: string | null;
    contentPreview: string | null;
  }> {
    const document = await this.documentArchiveService.getCurrentProjectVersionFile({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      versionLabel: params.versionLabel,
      fileKind: FileKind.QUOTATION_PDF,
    });

    if (!document) {
      throw new AppError("Preventivo PDF non trovato per la versione richiesta.", "QUOTATION_FILE_NOT_FOUND", 404);
    }

    const knowledge = await this.refreshDocumentKnowledge(params.workspaceId, document.id);
    return {
      documentId: document.id,
      fileName: document.filename,
      storagePath: document.storagePath,
      summaryText: knowledge.summaryText,
      contentPreview: knowledge.contentText?.slice(0, 1600) ?? null,
    };
  }

  public async searchWorkspaceKnowledge(params: {
    workspaceId: string;
    query: string;
    topK?: number;
    moduleId?: number | null;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
  }): Promise<KnowledgeSearchHitEntity[]> {
    const normalizedQuery = params.query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const embedding = await this.embeddingService.embed(normalizedQuery);
    return this.repository.semanticSearch({
      workspaceId: params.workspaceId,
      queryVector: embedding.vector,
      topK: params.topK ?? this.defaultTopK,
      moduleId: params.moduleId,
      sourceEntityType: params.sourceEntityType,
      sourceEntityId: params.sourceEntityId,
    });
  }

  public async searchWorkspaceKnowledgeByKeyword(params: {
    workspaceId: string;
    query: string;
    topK?: number;
    moduleId?: number | null;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
  }): Promise<KnowledgeSearchHitEntity[]> {
    const normalizedQuery = params.query.trim();
    if (!normalizedQuery) {
      return [];
    }

    return this.repository.keywordSearch({
      workspaceId: params.workspaceId,
      queryText: normalizedQuery,
      topK: params.topK ?? this.defaultTopK,
      moduleId: params.moduleId,
      sourceEntityType: params.sourceEntityType,
      sourceEntityId: params.sourceEntityId,
    });
  }

  private async extractDocumentText(source: SourceDocumentRecord): Promise<{
    text: string;
    representationKey: string;
    extractionKind: string;
    payload: Record<string, unknown> | null;
  }> {
    if (this.isPdfDocument(source)) {
      const response = await this.pythonModulesClient.execute("ocr_engine", "extract_text_from_pdf_storage", {
        storage_path: source.storagePath,
      });
      const output = response.output && typeof response.output === "object"
        ? response.output as Record<string, unknown>
        : {};
      const text = String(output.extracted_text ?? "").trim();
      if (!text) {
        throw new AppError("OCR completato ma testo non disponibile.", "KNOWLEDGE_OCR_EMPTY", 422);
      }

      return {
        text,
        representationKey: "ocr_text",
        extractionKind: "ocr_engine",
        payload: output,
      };
    }

    const binary = await this.documentArchiveService.getBinaryByStoragePath(source.storagePath);
    if (binary && (source.contentType?.startsWith("text/") || this.isTextLikeFile(source.filename))) {
      const text = binary.bytes.toString("utf8").trim();
      if (!text) {
        throw new AppError("Il documento testuale e vuoto.", "KNOWLEDGE_TEXT_EMPTY", 422);
      }

      return {
        text,
        representationKey: "plain_text",
        extractionKind: "text_direct",
        payload: null,
      };
    }

    throw new AppError(
      "Tipo documento non ancora supportato per document intelligence. Attualmente sono supportati soprattutto i PDF in Garage.",
      "KNOWLEDGE_UNSUPPORTED_DOCUMENT",
      400,
    );
  }

  private async buildChunkModels(text: string): Promise<Array<{
    chunkIndex: number;
    contentText: string;
    tokenEstimate: number;
    embeddingStatus: string;
    embeddingProvider: string | null;
    embeddingModel: string | null;
    embeddingDimensions: number | null;
    embeddingVector: number[] | null;
    embeddingPayload: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    embeddedAt: Date | null;
  }>> {
    const chunks = this.chunkText(text);
    const results = [] as Array<{
      chunkIndex: number;
      contentText: string;
      tokenEstimate: number;
      embeddingStatus: string;
      embeddingProvider: string | null;
      embeddingModel: string | null;
      embeddingDimensions: number | null;
      embeddingVector: number[] | null;
      embeddingPayload: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
      embeddedAt: Date | null;
    }>;

    for (let index = 0; index < chunks.length; index += 1) {
      const chunkText = chunks[index] ?? "";
      const embedding = await this.embeddingService.embed(chunkText);
      results.push({
        chunkIndex: index,
        contentText: chunkText,
        tokenEstimate: this.estimateTokens(chunkText),
        embeddingStatus: "READY",
        embeddingProvider: embedding.provider,
        embeddingModel: embedding.model,
        embeddingDimensions: embedding.dimensions,
        embeddingVector: embedding.vector,
        embeddingPayload: embedding.payload,
        metadata: {
          char_length: chunkText.length,
        },
        embeddedAt: new Date(),
      });
    }

    return results;
  }

  private chunkText(text: string): string[] {
    const normalized = text.replace(/\r/g, "").trim();
    if (!normalized) {
      return [];
    }

    const chunkSize = 1400;
    const overlap = 200;
    const chunks: string[] = [];
    let start = 0;

    while (start < normalized.length) {
      const end = Math.min(normalized.length, start + chunkSize);
      const slice = normalized.slice(start, end).trim();
      if (slice) {
        chunks.push(slice);
      }

      if (end >= normalized.length) {
        break;
      }

      start = Math.max(end - overlap, start + 1);
    }

    return chunks;
  }

  private async ensureDocumentKnowledge(source: SourceDocumentRecord): Promise<KnowledgeDocumentEntity> {
    const representationKey = this.isPdfDocument(source) ? "ocr_text" : "plain_text";
    const existing = await this.repository.findKnowledgeDocumentByDocumentId(source.workspaceId, source.id, representationKey);
    if (existing && existing.extractionStatus === "READY" && (existing.contentText?.trim() || existing.summaryText?.trim())) {
      return existing;
    }

    return this.refreshDocumentKnowledge(source.workspaceId, source.id);
  }

  private async resolveKnowledgeDocumentForMode(
    workspaceId: string,
    documentId: string,
    knowledgeMode: KnowledgeMode,
  ): Promise<KnowledgeDocumentEntity> {
    const source = await this.loadNormalizedSourceDocument(workspaceId, documentId);
    if (!source) {
      throw new AppError("Documento sorgente non trovato.", "KNOWLEDGE_SOURCE_NOT_FOUND", 404);
    }

    const representationKey = this.isPdfDocument(source) ? "ocr_text" : "plain_text";
    const existing = await this.repository.findKnowledgeDocumentByDocumentId(workspaceId, source.id, representationKey);
    if (existing && existing.extractionStatus === "READY" && (existing.contentText?.trim() || existing.summaryText?.trim())) {
      return existing;
    }

    if (knowledgeMode === "saved") {
      throw new AppError(
        "Knowledge non disponibile per uno dei documenti selezionati. Usa on-demand o hybrid per indicizzarlo automaticamente.",
        "KNOWLEDGE_DOCUMENT_NOT_INDEXED",
        409,
      );
    }

    return this.ensureDocumentKnowledge(source);
  }

  private async loadNormalizedSourceDocument(workspaceId: string, documentId: string): Promise<SourceDocumentRecord | null> {
    const source = await this.repository.findSourceDocumentById(workspaceId, documentId);
    if (!source) {
      return null;
    }

    return this.normalizeSourceDocument(source);
  }

  private async normalizeSourceDocument(source: SourceDocumentRecord): Promise<SourceDocumentRecord> {
    if (source.domainEntityType !== "DdtDocument" || source.domainEntityId?.trim()) {
      return source;
    }

    const prisma = PrismaClientManager.getClient();
    const ddtRow = await prisma.ddtDocument.findFirst({
      where: {
        workspace_id: source.workspaceId,
        document_id: source.id,
      },
      select: {
        id: true,
      },
    });

    if (!ddtRow?.id) {
      return source;
    }

    await prisma.document.update({
      where: {
        id: source.id,
      },
      data: {
        domain_entity_id: ddtRow.id,
      },
    });

    return {
      ...source,
      domainEntityId: ddtRow.id,
    };
  }

  private buildPreviewText(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return null;
    }

    return normalized.slice(0, 6000);
  }

  private buildDocumentSetPrompt(
    prompt: string,
    documents: Array<{
      documentId: string;
      title: string;
      sourceLabel: string | null;
      summaryText: string | null;
      contentText: string;
    }>,
  ): string {
    const maxTotalChars = 50_000;
    const maxPerDocumentChars = Math.max(2_000, Math.floor(maxTotalChars / Math.max(1, documents.length)));
    const parts = [
      `Richiesta utente:\n${prompt}`,
      "Documenti disponibili:",
    ];
    let usedChars = parts.join("\n\n").length;

    documents.forEach((document, index) => {
      const compactContent = document.contentText.replace(/\s+/g, " ").trim();
      const remaining = Math.max(0, maxTotalChars - usedChars);
      const sliceLength = Math.min(maxPerDocumentChars, remaining);
      const content = compactContent.slice(0, sliceLength);
      const section = [
        `Documento ${index + 1}: ${document.title}`,
        `document_id: ${document.documentId}`,
        document.sourceLabel ? `percorso: ${document.sourceLabel}` : null,
        document.summaryText ? `summary esistente: ${document.summaryText}` : null,
        `contenuto:\n${content}${compactContent.length > content.length ? "\n[contenuto troncato]" : ""}`,
      ].filter(Boolean).join("\n");
      parts.push(section);
      usedChars += section.length;
    });

    return parts.join("\n\n---\n\n");
  }

  private buildSummary(text: string): string {
    const compact = text.replace(/\s+/g, " ").trim();
    if (compact.length <= 400) {
      return compact;
    }

    return `${compact.slice(0, 397)}...`;
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private isPdfDocument(source: SourceDocumentRecord): boolean {
    return source.contentType === "application/pdf"
      || source.filename?.toLowerCase().endsWith(".pdf") === true;
  }

  private isTextLikeFile(fileName: string | null): boolean {
    return fileName?.toLowerCase().endsWith(".txt") === true;
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
