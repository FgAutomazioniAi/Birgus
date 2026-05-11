import { Job } from "../queue/Job.js";
import { JobHandler } from "../queue/JobHandler.js";
import { DdtProcessingJobPayload } from "../../modules/ddt-processing/services/DdtProcessingService.js";
import { DdtProcessingRepository } from "../../modules/ddt-processing/repositories/DdtProcessingRepository.js";
import { DdtAnalyzer } from "../../modules/ddt-processing/services/DdtAnalyzer.js";
import { DocumentIntelligenceService } from "../../modules/document-intelligence/services/DocumentIntelligenceService.js";

export class DdtProcessingWorker implements JobHandler<DdtProcessingJobPayload> {
  private readonly repository: DdtProcessingRepository;
  private readonly analyzer: DdtAnalyzer;
  private readonly documentIntelligenceService: DocumentIntelligenceService;

  public constructor(
    repository: DdtProcessingRepository,
    analyzer: DdtAnalyzer,
    documentIntelligenceService: DocumentIntelligenceService,
  ) {
    this.repository = repository;
    this.analyzer = analyzer;
    this.documentIntelligenceService = documentIntelligenceService;
  }

  public async handle(job: Job<DdtProcessingJobPayload>): Promise<void> {
    const payload = job.payload;

    await this.repository.updateJobStatus(payload.jobId, "RUNNING");
    await this.repository.updateDocumentStatus(payload.ddtDocumentId, "OCR_PROCESSING");
    await this.repository.appendEvent(payload.jobId, payload.ddtDocumentId, "ocr_processing");

    try {
      await this.repository.updateDocumentStatus(payload.ddtDocumentId, "AI_PROCESSING");
      await this.repository.appendEvent(payload.jobId, payload.ddtDocumentId, "ai_processing");

      const analysis = await this.analyzer.analyze(payload.ddtDocumentId);
      await this.repository.saveAnalysis(payload.ddtDocumentId, analysis);
      await this.indexDocumentKnowledge(payload);

      await this.repository.updateDocumentStatus(payload.ddtDocumentId, "READY");
      await this.repository.updateJobStatus(payload.jobId, "COMPLETED");
      await this.repository.appendEvent(payload.jobId, payload.ddtDocumentId, "completed", {
        articleCount: analysis.articleCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error";
      await this.repository.updateDocumentStatus(payload.ddtDocumentId, "ERROR", message);
      await this.repository.updateJobStatus(payload.jobId, "FAILED", message);
      await this.repository.appendEvent(payload.jobId, payload.ddtDocumentId, "failed", {
        message,
      });
      throw error;
    }
  }

  private async indexDocumentKnowledge(payload: DdtProcessingJobPayload): Promise<void> {
    const reference = await this.repository.findDocumentReference(payload.ddtDocumentId);
    if (!reference) {
      await this.repository.appendEvent(payload.jobId, payload.ddtDocumentId, "knowledge_index_skipped", {
        reason: "document_reference_not_found",
      });
      return;
    }

    try {
      await this.documentIntelligenceService.refreshDocumentKnowledge(reference.workspaceId, reference.documentId);
      await this.repository.appendEvent(payload.jobId, payload.ddtDocumentId, "knowledge_index_completed", {
        documentId: reference.documentId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Knowledge indexing error";
      await this.repository.appendEvent(payload.jobId, payload.ddtDocumentId, "knowledge_index_failed", {
        documentId: reference.documentId,
        message,
      });
      console.error("[DdtProcessingWorker] Unable to index DDT document knowledge", {
        jobId: payload.jobId,
        ddtDocumentId: payload.ddtDocumentId,
        documentId: reference.documentId,
        message,
      });
    }
  }
}
