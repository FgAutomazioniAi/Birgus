import { Prisma } from "@prisma/client";

import { PrismaClientManager } from "../../database/PrismaClientManager.js";
import { AppError } from "../../core/errors/AppError.js";
import { Job } from "./Job.js";
import { JobHandler } from "./JobHandler.js";
import { JobQueue } from "./JobQueue.js";

interface ClaimedJobRow {
  id: string;
  name: string;
  payload: Prisma.JsonValue;
}

export class PostgresJobQueue implements JobQueue {
  private readonly handlers: Map<string, JobHandler<unknown>>;
  private readonly workerId: string;
  private readonly workerCount: number;
  private readonly pollIntervalMs: number;
  private started: boolean;

  public constructor() {
    this.handlers = new Map<string, JobHandler<unknown>>();
    this.workerId = `birgus-${process.pid}`;
    this.workerCount = this.toPositiveInt(process.env.BACKEND_QUEUE_WORKERS, 2);
    this.pollIntervalMs = this.toPositiveInt(process.env.BACKEND_QUEUE_POLL_MS, 750);
    this.started = false;
  }

  public register<TPayload>(jobName: string, handler: JobHandler<TPayload>): void {
    this.handlers.set(jobName, handler as JobHandler<unknown>);
  }

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    void this.recoverRunningJobs().catch((error) => {
      console.error("[PostgresJobQueue] Unable to recover running jobs", error);
    });

    for (let index = 0; index < this.workerCount; index += 1) {
      void this.pollLoop(index + 1);
    }
  }

  public async enqueue<TPayload>(job: Job<TPayload>): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    try {
      await prisma.$executeRaw`
        INSERT INTO backend_jobs (id, name, payload, status, available_at, created_at, updated_at)
        VALUES (
          ${job.id},
          ${job.name},
          CAST(${JSON.stringify(job.payload as Prisma.InputJsonValue)} AS jsonb),
          'QUEUED',
          ${job.createdAt},
          ${job.createdAt},
          ${job.createdAt}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        return;
      }

      throw new AppError("Impossibile accodare il job su Postgres.", "BACKEND_JOB_ENQUEUE_FAILED", 500);
    }
  }

  private async pollLoop(slot: number): Promise<void> {
    while (this.started) {
      const job = await this.claimNextJob().catch((error) => {
        console.error("[PostgresJobQueue] Job claim failed", { slot, error });
        return null;
      });

      if (!job) {
        await this.sleep(this.pollIntervalMs);
        continue;
      }

      const handler = this.handlers.get(job.name);
      if (!handler) {
        await this.failJob(job.id, `No handler registered for job '${job.name}'.`);
        continue;
      }

      try {
        await handler.handle(new Job(job.id, job.name, job.payload));
        await this.completeJob(job.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown backend job failure";
        await this.failJob(job.id, message);
      }
    }
  }

  private async claimNextJob(): Promise<ClaimedJobRow | null> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.$queryRaw<ClaimedJobRow[]>`
      WITH next_job AS (
        SELECT id
        FROM backend_jobs
        WHERE status = 'QUEUED'
          AND available_at <= NOW()
        ORDER BY available_at ASC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE backend_jobs AS jobs
      SET status = 'RUNNING',
          claimed_at = NOW(),
          claimed_by = ${this.workerId},
          attempts = jobs.attempts + 1,
          updated_at = NOW()
      FROM next_job
      WHERE jobs.id = next_job.id
      RETURNING jobs.id, jobs.name, jobs.payload
    `;

    return rows[0] ?? null;
  }

  private async completeJob(jobId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.$executeRaw`
      UPDATE backend_jobs
      SET status = 'COMPLETED',
          completed_at = NOW(),
          claimed_at = NULL,
          claimed_by = NULL,
          last_error = NULL,
          updated_at = NOW()
      WHERE id = ${jobId}
    `;
  }

  private async failJob(jobId: string, message: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.$executeRaw`
      UPDATE backend_jobs
      SET status = 'FAILED',
          claimed_at = NULL,
          claimed_by = NULL,
          last_error = ${message.slice(0, 2000)},
          updated_at = NOW()
      WHERE id = ${jobId}
    `;
  }

  private async recoverRunningJobs(): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.$executeRaw`
      UPDATE backend_jobs
      SET status = 'QUEUED',
          claimed_at = NULL,
          claimed_by = NULL,
          updated_at = NOW()
      WHERE status = 'RUNNING'
    `;
  }

  private isUniqueConstraint(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
