import { AppError } from "../../core/errors/AppError.js";
import { Job } from "./Job.js";
import { JobHandler } from "./JobHandler.js";
import { JobQueue } from "./JobQueue.js";

export class InMemoryJobQueue implements JobQueue {
  private readonly handlers: Map<string, JobHandler<unknown>>;

  public constructor() {
    this.handlers = new Map<string, JobHandler<unknown>>();
  }

  public register<TPayload>(jobName: string, handler: JobHandler<TPayload>): void {
    this.handlers.set(jobName, handler as JobHandler<unknown>);
  }

  public async enqueue<TPayload>(job: Job<TPayload>): Promise<void> {
    const handler = this.handlers.get(job.name);

    if (!handler) {
      throw new AppError(`No handler registered for job '${job.name}'.`, "JOB_HANDLER_NOT_FOUND", 500);
    }

    await handler.handle(job as Job<unknown>);
  }
}
