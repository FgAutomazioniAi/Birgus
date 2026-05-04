import { AppError } from "../../core/errors/AppError.js";
import { Job } from "./Job.js";
import { JobHandler } from "./JobHandler.js";
import { JobQueue } from "./JobQueue.js";

export class InMemoryJobQueue implements JobQueue {
  private readonly handlers: Map<string, JobHandler<unknown>>;
  private readonly pendingJobs: Array<Job<unknown>>;
  private processing: boolean;

  public constructor() {
    this.handlers = new Map<string, JobHandler<unknown>>();
    this.pendingJobs = [];
    this.processing = false;
  }

  public register<TPayload>(jobName: string, handler: JobHandler<TPayload>): void {
    this.handlers.set(jobName, handler as JobHandler<unknown>);
  }

  public async enqueue<TPayload>(job: Job<TPayload>): Promise<void> {
    const handler = this.handlers.get(job.name);

    if (!handler) {
      throw new AppError(`No handler registered for job '${job.name}'.`, "JOB_HANDLER_NOT_FOUND", 500);
    }

    // Fire-and-forget: la route HTTP torna subito; i job vengono processati in FIFO a concorrenza 1.
    this.pendingJobs.push(job as Job<unknown>);
    if (!this.processing) {
      this.processing = true;
      void this.drainQueue();
    }
  }

  private async drainQueue(): Promise<void> {
    while (this.pendingJobs.length > 0) {
      const nextJob = this.pendingJobs.shift();
      if (!nextJob) {
        continue;
      }

      const handler = this.handlers.get(nextJob.name);
      if (!handler) {
        console.error(`[InMemoryJobQueue] No handler registered for job '${nextJob.name}'.`);
        continue;
      }

      try {
        await handler.handle(nextJob);
      } catch (error: unknown) {
        // Il worker ha gia registrato stato/errore nel repository; qui evitiamo rejection non gestite.
        console.error("[InMemoryJobQueue] Job execution failed", error);
      }
    }

    this.processing = false;
  }
}
