import { Job } from "../../../worker/queue/Job.js";
import { JobQueue } from "../../../worker/queue/JobQueue.js";
import { StartDdtProcessingCommand } from "../dto/StartDdtProcessingCommand.js";
import { DdtProcessingRepository } from "../repositories/DdtProcessingRepository.js";

export interface DdtProcessingJobPayload {
  workspaceId: string;
  ddtDocumentId: string;
  jobId: string;
}

export class DdtProcessingService {
  public static readonly JOB_NAME = "ddt.processing";

  private readonly repository: DdtProcessingRepository;
  private readonly queue: JobQueue;

  public constructor(repository: DdtProcessingRepository, queue: JobQueue) {
    this.repository = repository;
    this.queue = queue;
  }

  public async queueAnalysis(command: StartDdtProcessingCommand): Promise<{ jobId: string; ddtDocumentId: string }> {
    const ddtDocument = await this.repository.upsertDdtDocument({
      workspaceId: command.workspaceId,
      documentId: command.documentId,
      requestedByUserId: command.requestedByUserId,
    });

    await this.repository.updateDocumentStatus(ddtDocument.id, "QUEUED");

    const jobId = await this.repository.createJob(command.workspaceId, ddtDocument.id);
    await this.repository.appendEvent(jobId, ddtDocument.id, "queued", {
      source: "application",
    });

    const payload: DdtProcessingJobPayload = {
      workspaceId: command.workspaceId,
      ddtDocumentId: ddtDocument.id,
      jobId,
    };

    await this.queue.enqueue(new Job(this.buildQueueJobId(jobId), DdtProcessingService.JOB_NAME, payload));

    return {
      jobId,
      ddtDocumentId: ddtDocument.id,
    };
  }

  public async resumePendingJobs(): Promise<void> {
    const jobs = await this.repository.listRecoverableJobs();

    for (const job of jobs) {
      await this.repository.appendEvent(job.jobId, job.ddtDocumentId, "recovered", {
        source: "application_startup",
      });

      const payload: DdtProcessingJobPayload = {
        workspaceId: job.workspaceId,
        ddtDocumentId: job.ddtDocumentId,
        jobId: job.jobId,
      };

      await this.queue.enqueue(new Job(this.buildQueueJobId(job.jobId), DdtProcessingService.JOB_NAME, payload));
    }
  }

  private buildQueueJobId(jobId: string): string {
    return `ddt:${jobId}`;
  }
}
