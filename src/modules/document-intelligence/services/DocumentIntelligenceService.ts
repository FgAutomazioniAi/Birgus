import { createHash } from "node:crypto";

import { AppError } from "../../../core/errors/AppError.js";
import { FileKind } from "../../document-archive/domain/FileKind.js";
import { DocumentArchiveService } from "../../document-archive/services/DocumentArchiveService.js";
import { KnowledgeDocumentEntity } from "../domain/KnowledgeDocumentEntity.js";
import { KnowledgeSearchHitEntity } from "../domain/KnowledgeSearchHitEntity.js";
import { PrismaKnowledgeRepository } from "../infra/PrismaKnowledgeRepository.js";
import { KnowledgeRepository, SourceDocumentRecord } from "../repositories/KnowledgeRepository.js";
import { BackendPythonModulesClient } from "./BackendPythonModulesClient.js";
import { KnowledgeEmbeddingService } from "./KnowledgeEmbeddingService.js";

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
    const source = await this.repository.findSourceDocumentById(workspaceId, documentId);
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
