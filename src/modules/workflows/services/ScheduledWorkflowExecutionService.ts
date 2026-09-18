import { Logger } from "@nestjs/common";
import { Prisma, ScheduledWorkflowExecutionStatus } from "@prisma/client";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { WorkflowService } from "./WorkflowService.js";

export type ScheduledWorkflowExecutionDto = {
  id: string;
  workflowId: string;
  workflowLabel: string;
  label: string | null;
  repeatEverySeconds: number;
  status: "ACTIVE" | "PAUSED";
  nextRunAt: Date;
  lastRunAt: Date | null;
  lastWorkflowRunId: string | null;
  lastError: string | null;
  createdAt: Date;
};

export class ScheduledWorkflowExecutionService {
  private readonly logger = new Logger(ScheduledWorkflowExecutionService.name);
  private readonly pollIntervalMs: number;
  private readonly minRepeatSeconds: number;
  private readonly maxActivePerWorkspace: number;
  private readonly processingLeaseMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  public constructor(private readonly workflowService: WorkflowService) {
    this.pollIntervalMs = this.readPositiveInt(
      "SCHEDULED_WORKFLOW_EXECUTION_POLL_MS",
      30_000,
    );
    this.minRepeatSeconds = this.readPositiveInt(
      "SCHEDULED_WORKFLOW_EXECUTION_MIN_REPEAT_SECONDS",
      300,
    );
    this.maxActivePerWorkspace = this.readPositiveInt(
      "SCHEDULED_WORKFLOW_EXECUTION_MAX_ACTIVE",
      100,
    );
    this.processingLeaseMs = this.readPositiveInt(
      "SCHEDULED_WORKFLOW_EXECUTION_PROCESSING_LEASE_MS",
      5 * 60_000,
    );
  }

  public start(): void {
    if (this.timer) return;
    void this.processDueSchedules();
    this.timer = setInterval(
      () => void this.processDueSchedules(),
      this.pollIntervalMs,
    );
    this.timer.unref?.();
    this.logger.log(
      `Scheduled workflow execution worker started every ${this.pollIntervalMs}ms.`,
    );
  }

  public async create(params: {
    workspaceId: string;
    workflowId: string;
    createdByUserId: string;
    label?: string | null;
    startsAt: Date;
    repeatEverySeconds: number;
    inputPayload?: unknown | null;
  }): Promise<ScheduledWorkflowExecutionDto> {
    this.validateTiming(params.startsAt, params.repeatEverySeconds);
    const workflow = await this.workflowService.getWorkflow(
      params.workspaceId,
      params.workflowId,
    );
    if (!workflow.isEnabled) {
      throw new AppError(
        "Il workflow selezionato e' disabilitato.",
        "WORKFLOW_SCHEDULE_WORKFLOW_DISABLED",
        409,
      );
    }

    const prisma = PrismaClientManager.getClient();
    const activeCount = await prisma.scheduledWorkflowExecution.count({
      where: {
        workspace_id: params.workspaceId,
        status: ScheduledWorkflowExecutionStatus.ACTIVE,
      },
    });
    if (activeCount >= this.maxActivePerWorkspace) {
      throw new AppError(
        `Limite di ${this.maxActivePerWorkspace} schedulazioni attive raggiunto nel workspace.`,
        "WORKFLOW_SCHEDULE_LIMIT_REACHED",
        409,
      );
    }

    const row = await prisma.scheduledWorkflowExecution.create({
      data: {
        workspace_id: params.workspaceId,
        workflow_id: workflow.id,
        created_by_user_id: params.createdByUserId,
        label: params.label?.trim() || null,
        input_payload: this.toJsonInput(params.inputPayload),
        repeat_every_seconds: params.repeatEverySeconds,
        next_run_at: params.startsAt,
      },
      include: { workflow: { select: { label: true } } },
    });
    return this.toDto(row);
  }

  public async listMine(
    workspaceId: string,
    userId: string,
  ): Promise<ScheduledWorkflowExecutionDto[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.scheduledWorkflowExecution.findMany({
      where: { workspace_id: workspaceId, created_by_user_id: userId },
      include: { workflow: { select: { label: true } } },
      orderBy: [{ status: "asc" }, { next_run_at: "asc" }],
    });
    return rows.map((row) => this.toDto(row));
  }

  public async setPaused(
    workspaceId: string,
    id: string,
    paused: boolean,
  ): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const updated = await prisma.scheduledWorkflowExecution.updateMany({
      where: { id, workspace_id: workspaceId },
      data: {
        status: paused
          ? ScheduledWorkflowExecutionStatus.PAUSED
          : ScheduledWorkflowExecutionStatus.ACTIVE,
      },
    });
    if (updated.count === 0)
      throw new AppError(
        "Schedulazione non trovata.",
        "WORKFLOW_SCHEDULE_NOT_FOUND",
        404,
      );
  }

  public async remove(workspaceId: string, id: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const deleted = await prisma.scheduledWorkflowExecution.deleteMany({
      where: { id, workspace_id: workspaceId },
    });
    if (deleted.count === 0)
      throw new AppError(
        "Schedulazione non trovata.",
        "WORKFLOW_SCHEDULE_NOT_FOUND",
        404,
      );
  }

  public async processDueSchedules(limit = 20): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;
    try {
      const prisma = PrismaClientManager.getClient();
      await prisma.scheduledWorkflowExecution.updateMany({
        where: {
          status: ScheduledWorkflowExecutionStatus.PROCESSING,
          updated_at: { lte: new Date(Date.now() - this.processingLeaseMs) },
        },
        data: {
          status: ScheduledWorkflowExecutionStatus.ACTIVE,
          last_error:
            "Schedulazione ripresa automaticamente dopo un'interruzione del worker.",
        },
      });
      const due = await prisma.scheduledWorkflowExecution.findMany({
        where: {
          status: ScheduledWorkflowExecutionStatus.ACTIVE,
          next_run_at: { lte: new Date() },
        },
        select: { id: true },
        orderBy: { next_run_at: "asc" },
        take: limit,
      });
      let processed = 0;
      for (const row of due) if (await this.processOne(row.id)) processed += 1;
      return processed;
    } finally {
      this.isProcessing = false;
    }
  }

  private async processOne(id: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const claimed = await prisma.scheduledWorkflowExecution.updateMany({
      where: { id, status: ScheduledWorkflowExecutionStatus.ACTIVE },
      data: {
        status: ScheduledWorkflowExecutionStatus.PROCESSING,
        last_error: null,
      },
    });
    if (claimed.count === 0) return false;

    const schedule = await prisma.scheduledWorkflowExecution.findUnique({
      where: { id },
    });
    if (!schedule) return false;
    try {
      const run = await this.workflowService.createWorkflowRun({
        workspaceId: schedule.workspace_id,
        workflowId: schedule.workflow_id,
        requestedByUserId: schedule.created_by_user_id,
        triggerSource: "scheduled",
        contextEntityType: "scheduled_workflow_execution",
        contextEntityId: schedule.id,
        projectId: null,
        projectVersionId: null,
        clientId: null,
        documentId: null,
        ddtDocumentId: null,
        measureReportDocumentId: null,
        inputPayload: schedule.input_payload,
      });
      const now = new Date();
      await prisma.scheduledWorkflowExecution.update({
        where: { id },
        data: {
          status: ScheduledWorkflowExecutionStatus.ACTIVE,
          last_run_at: now,
          last_workflow_run_id: run.id,
          next_run_at: this.nextRunAfter(
            schedule.next_run_at,
            schedule.repeat_every_seconds,
            now,
          ),
          last_error: null,
        },
      });
      return true;
    } catch (error) {
      await prisma.scheduledWorkflowExecution.update({
        where: { id },
        data: {
          status: ScheduledWorkflowExecutionStatus.ACTIVE,
          next_run_at: new Date(Date.now() + 60_000),
          last_error: this.sanitizeError(error),
        },
      });
      return false;
    }
  }

  private nextRunAfter(
    previous: Date,
    repeatEverySeconds: number,
    now: Date,
  ): Date {
    const intervalMs = repeatEverySeconds * 1000;
    let next = new Date(previous.getTime() + intervalMs);
    while (next <= now) next = new Date(next.getTime() + intervalMs);
    return next;
  }

  private validateTiming(startsAt: Date, repeatEverySeconds: number): void {
    if (
      Number.isNaN(startsAt.getTime()) ||
      startsAt.getTime() < Date.now() - 60_000
    ) {
      throw new AppError(
        "L'orario di avvio deve essere futuro.",
        "WORKFLOW_SCHEDULE_START_INVALID",
        400,
      );
    }
    if (
      !Number.isInteger(repeatEverySeconds) ||
      repeatEverySeconds < this.minRepeatSeconds
    ) {
      throw new AppError(
        `L'intervallo minimo e' ${this.minRepeatSeconds} secondi.`,
        "WORKFLOW_SCHEDULE_REPEAT_INVALID",
        400,
      );
    }
  }

  private toDto(row: {
    id: string;
    workflow_id: string;
    label: string | null;
    repeat_every_seconds: number;
    status: ScheduledWorkflowExecutionStatus;
    next_run_at: Date;
    last_run_at: Date | null;
    last_workflow_run_id: string | null;
    last_error: string | null;
    created_at: Date;
    workflow: { label: string };
  }): ScheduledWorkflowExecutionDto {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowLabel: row.workflow.label,
      label: row.label,
      repeatEverySeconds: row.repeat_every_seconds,
      status:
        row.status === ScheduledWorkflowExecutionStatus.PAUSED
          ? "PAUSED"
          : "ACTIVE",
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      lastWorkflowRunId: row.last_workflow_run_id,
      lastError: row.last_error,
      createdAt: row.created_at,
    };
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined || value === null
      ? undefined
      : (value as Prisma.InputJsonValue);
  }

  private sanitizeError(error: unknown): string {
    return (error instanceof Error ? error.message : String(error)).slice(
      0,
      500,
    );
  }

  private readPositiveInt(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
