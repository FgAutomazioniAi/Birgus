import { randomUUID } from "node:crypto";

import { Job } from "../../../worker/queue/Job.js";
import { JobQueue } from "../../../worker/queue/JobQueue.js";
import { WorkflowRunDispatcher } from "./WorkflowRunDispatcher.js";

export interface WorkflowRunJobPayload {
  runId: string;
}

export class QueueWorkflowRunDispatcher implements WorkflowRunDispatcher {
  public static readonly JOB_NAME = "workflow.run.execute";

  private readonly queue: JobQueue;

  public constructor(queue: JobQueue) {
    this.queue = queue;
  }

  public async dispatch(runId: string): Promise<void> {
    await this.queue.enqueue(
      new Job<WorkflowRunJobPayload>(randomUUID(), QueueWorkflowRunDispatcher.JOB_NAME, { runId }),
    );
  }
}
