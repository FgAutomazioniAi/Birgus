import { Controller, Get, HttpCode, Inject, Param, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { AppError } from "../../core/errors/AppError.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { ModuleWorkflowRunEntity } from "../../modules/workflows/domain/ModuleWorkflowRunEntity.js";
import { WorkflowService } from "../../modules/workflows/services/WorkflowService.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";

@Controller("/api/orchestrator")
@UseGuards(RequestContextAuthGuard)
export class NestOrchestratorController {
  public constructor(
    @Inject(QuotationOrchestratorService)
    private readonly orchestratorService: QuotationOrchestratorService,
    @Inject(WorkflowService)
    private readonly workflowService: WorkflowService,
  ) {}

  @Get("jobs/:jobId")
  @HttpCode(200)
  public async getJob(
    @Param("jobId") jobIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    const jobId = this.getJobId(jobIdRaw);
    const job = await this.orchestratorService.getJob(jobId);

    if (job) {
      return job;
    }

    const workflowRun = await this.workflowService.getWorkflowRun(requestContext.workspace.workspaceId, jobId).catch(() => null);
    if (!workflowRun) {
      throw new AppError("Job non trovato.", "ORCHESTRATOR_JOB_NOT_FOUND", 404);
    }

    return this.serializeWorkflowRunAsJob(workflowRun);
  }

  private getJobId(jobId: string): string {
    if (!jobId || !jobId.trim()) {
      throw new AppError("Job ID mancante.", "ORCHESTRATOR_JOB_ID_REQUIRED", 400);
    }

    return z.string().uuid().parse(jobId.trim());
  }

  private serializeWorkflowRunAsJob(run: ModuleWorkflowRunEntity): Record<string, unknown> {
    const status = run.status.toLowerCase();
    const latestStep = [...run.steps].reverse().find((step) => step.status !== "QUEUED") ?? run.steps.at(-1) ?? null;
    const completedSteps = run.steps.filter((step) => step.status === "COMPLETED").length;
    const totalSteps = Math.max(run.steps.length, 1);
    const progress = status === "completed" || status === "failed"
      ? 100
      : status === "queued"
        ? 1
        : Math.max(5, Math.min(95, Math.round((completedSteps / totalSteps) * 95)));
    const message = run.errorMessage
      ?? latestStep?.errorMessage
      ?? (latestStep ? `Workflow: ${latestStep.stepKey}` : "Workflow in coda.");

    return {
      job_id: run.id,
      status,
      progress,
      message,
      step: latestStep?.stepKey ?? status,
      error: run.errorMessage,
      request: {
        project_uuid: run.projectId,
        client_name: null,
        metadata: {
          source: "module_workflow_run",
          version_label: run.projectVersionId,
          workflow_key: run.workflowKey,
        },
      },
      result: run.resultPayload,
    };
  }
}
