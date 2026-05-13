import { JobQueue } from "../queue/JobQueue.js";
import { DdtProcessingService } from "../../modules/ddt-processing/services/DdtProcessingService.js";
import { DdtProcessingWorker } from "./DdtProcessingWorker.js";
import { QueueWorkflowRunDispatcher } from "../../modules/workflows/services/QueueWorkflowRunDispatcher.js";
import { WorkflowRunWorker } from "./WorkflowRunWorker.js";

export class WorkerCoordinator {
  private readonly queue: JobQueue;
  private readonly ddtProcessingWorker: DdtProcessingWorker;
  private readonly workflowRunWorker: WorkflowRunWorker;

  public constructor(queue: JobQueue, ddtProcessingWorker: DdtProcessingWorker, workflowRunWorker: WorkflowRunWorker) {
    this.queue = queue;
    this.ddtProcessingWorker = ddtProcessingWorker;
    this.workflowRunWorker = workflowRunWorker;
  }

  public registerHandlers(): void {
    this.queue.register(DdtProcessingService.JOB_NAME, this.ddtProcessingWorker);
    this.queue.register(QueueWorkflowRunDispatcher.JOB_NAME, this.workflowRunWorker);
  }
}
