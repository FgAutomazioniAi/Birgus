import { JobQueue } from "../queue/JobQueue.js";
import { DdtProcessingService } from "../../modules/ddt-processing/services/DdtProcessingService.js";
import { DdtProcessingWorker } from "./DdtProcessingWorker.js";

export class WorkerCoordinator {
  private readonly queue: JobQueue;
  private readonly ddtProcessingWorker: DdtProcessingWorker;

  public constructor(queue: JobQueue, ddtProcessingWorker: DdtProcessingWorker) {
    this.queue = queue;
    this.ddtProcessingWorker = ddtProcessingWorker;
  }

  public registerHandlers(): void {
    this.queue.register(DdtProcessingService.JOB_NAME, this.ddtProcessingWorker);
  }
}
