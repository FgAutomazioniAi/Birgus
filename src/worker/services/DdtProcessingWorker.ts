import { Job } from "../queue/Job.js";
import { JobHandler } from "../queue/JobHandler.js";
import { DdtProcessingJobPayload } from "../../modules/ddt-processing/services/DdtProcessingService.js";
import { DdtProcessingRepository } from "../../modules/ddt-processing/repositories/DdtProcessingRepository.js";
import { DdtAnalyzer } from "../../modules/ddt-processing/services/DdtAnalyzer.js";

export class DdtProcessingWorker implements JobHandler<DdtProcessingJobPayload> {
  private readonly repository: DdtProcessingRepository;
  private readonly analyzer: DdtAnalyzer;

  public constructor(repository: DdtProcessingRepository, analyzer: DdtAnalyzer) {
    this.repository = repository;
    this.analyzer = analyzer;
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
}
