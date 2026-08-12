import { Job } from "../queue/Job.js";
import { JobHandler } from "../queue/JobHandler.js";
import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";

export interface QuotationJobPayload {
  jobId: string;
}

export class QuotationOrchestratorWorker implements JobHandler<QuotationJobPayload> {
  private readonly service: QuotationOrchestratorService;

  public constructor(service: QuotationOrchestratorService) {
    this.service = service;
  }

  public async handle(job: Job<QuotationJobPayload>): Promise<void> {
    await this.service.executeJob(job.payload.jobId);
  }
}
