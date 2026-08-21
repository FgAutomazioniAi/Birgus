import { Inject, Injectable, Logger } from "@nestjs/common";

import { DdtProcessingService } from "../../modules/ddt-processing/services/DdtProcessingService.js";
import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { ScheduledWorkflowDeliveryService } from "../../modules/workflows/services/ScheduledWorkflowDeliveryService.js";
import { TelegramLinkPollingService } from "../../modules/connected-apps/services/TelegramLinkPollingService.js";
import { WorkflowRunExecutorService } from "../../modules/workflows/services/WorkflowRunExecutorService.js";
import { WorkerCoordinator } from "../../worker/services/WorkerCoordinator.js";

@Injectable()
export class BackendRuntimeService {
  private readonly logger = new Logger(BackendRuntimeService.name);
  private started = false;

  public constructor(
    @Inject(WorkerCoordinator)
    private readonly workerCoordinator: WorkerCoordinator,
    @Inject(DdtProcessingService)
    private readonly ddtProcessingService: DdtProcessingService,
    @Inject(QuotationOrchestratorService)
    private readonly quotationOrchestratorService: QuotationOrchestratorService,
    @Inject(WorkflowRunExecutorService)
    private readonly workflowRunExecutorService: WorkflowRunExecutorService,
    @Inject(ScheduledWorkflowDeliveryService)
    private readonly scheduledWorkflowDeliveryService: ScheduledWorkflowDeliveryService,
    @Inject(TelegramLinkPollingService)
    private readonly telegramLinkPollingService: TelegramLinkPollingService,
  ) {}

  public async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    this.workerCoordinator.registerHandlers();
    this.scheduledWorkflowDeliveryService.start();
    this.telegramLinkPollingService.start();

    const results = await Promise.allSettled([
      this.ddtProcessingService.resumePendingJobs(),
      this.quotationOrchestratorService.resumePendingJobs(),
      this.workflowRunExecutorService.resumeRecoverableRuns(),
    ]);

    this.logResumeOutcome("DDT jobs", results[0]);
    this.logResumeOutcome("quotation jobs", results[1]);
    this.logResumeOutcome("workflow runs", results[2]);
  }

  private logResumeOutcome(label: string, result: PromiseSettledResult<void>): void {
    if (result.status === "fulfilled") {
      this.logger.log(`Resumed pending ${label}.`);
      return;
    }

    this.logger.error(`Unable to resume pending ${label}.`, result.reason);
  }
}
