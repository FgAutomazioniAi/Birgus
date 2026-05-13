import { Job } from "../queue/Job.js";
import { JobHandler } from "../queue/JobHandler.js";
import { WorkflowRunExecutorService } from "../../modules/workflows/services/WorkflowRunExecutorService.js";
import { WorkflowRunJobPayload } from "../../modules/workflows/services/QueueWorkflowRunDispatcher.js";

export class WorkflowRunWorker implements JobHandler<WorkflowRunJobPayload> {
  private readonly executor: WorkflowRunExecutorService;

  public constructor(executor: WorkflowRunExecutorService) {
    this.executor = executor;
  }

  public async handle(job: Job<WorkflowRunJobPayload>): Promise<void> {
    await this.executor.executeRun(job.payload.runId);
  }
}
