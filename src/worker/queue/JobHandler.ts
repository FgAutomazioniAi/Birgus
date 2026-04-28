import { Job } from "./Job.js";

export interface JobHandler<TPayload> {
  handle(job: Job<TPayload>): Promise<void>;
}
