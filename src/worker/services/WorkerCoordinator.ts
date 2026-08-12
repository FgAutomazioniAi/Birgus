import { JobQueue } from "../queue/JobQueue.js";
import { DdtProcessingService } from "../../modules/ddt-processing/services/DdtProcessingService.js";
import { DdtProcessingWorker } from "./DdtProcessingWorker.js";
import { QueueWorkflowRunDispatcher } from "../../modules/workflows/services/QueueWorkflowRunDispatcher.js";
import { WorkflowRunWorker } from "./WorkflowRunWorker.js";
import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { QuotationOrchestratorWorker } from "./QuotationOrchestratorWorker.js";

export class WorkerCoordinator {
  private readonly queue: JobQueue;
  private readonly ddtProcessingWorker: DdtProcessingWorker;
  private readonly workflowRunWorker: WorkflowRunWorker;
  private readonly quotationOrchestratorWorker: QuotationOrchestratorWorker;

  public constructor(
    queue: JobQueue,
    ddtProcessingWorker: DdtProcessingWorker,
    workflowRunWorker: WorkflowRunWorker,
    quotationOrchestratorWorker: QuotationOrchestratorWorker,
  ) {
    this.queue = queue;
    this.ddtProcessingWorker = ddtProcessingWorker;
    this.workflowRunWorker = workflowRunWorker;
    this.quotationOrchestratorWorker = quotationOrchestratorWorker;
  }

  public registerHandlers(): void {
    this.queue.register(DdtProcessingService.JOB_NAME, this.ddtProcessingWorker);
    this.queue.register(QueueWorkflowRunDispatcher.JOB_NAME, this.workflowRunWorker);
    this.queue.register(QuotationOrchestratorService.JOB_NAME, this.quotationOrchestratorWorker);
    this.queue.start();
  }
}
