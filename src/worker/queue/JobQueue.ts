import { Job } from "./Job.js";
import { JobHandler } from "./JobHandler.js";

export interface JobQueue {
  register<TPayload>(jobName: string, handler: JobHandler<TPayload>): void;
  enqueue<TPayload>(job: Job<TPayload>): Promise<void>;
}
