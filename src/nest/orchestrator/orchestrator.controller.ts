import { Controller, Get, HttpCode, Inject, Param, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { AppError } from "../../core/errors/AppError.js";
import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";

@Controller("/api/orchestrator")
@UseGuards(RequestContextAuthGuard)
export class NestOrchestratorController {
  public constructor(
    @Inject(QuotationOrchestratorService)
    private readonly orchestratorService: QuotationOrchestratorService,
  ) {}

  @Get("jobs/:jobId")
  @HttpCode(200)
  public async getJob(
    @Param("jobId") jobIdRaw: string,
  ) {
    const jobId = this.getJobId(jobIdRaw);
    const job = await this.orchestratorService.getJob(jobId);

    if (!job) {
      throw new AppError("Job non trovato.", "ORCHESTRATOR_JOB_NOT_FOUND", 404);
    }

    return job;
  }

  private getJobId(jobId: string): string {
    if (!jobId || !jobId.trim()) {
      throw new AppError("Job ID mancante.", "ORCHESTRATOR_JOB_ID_REQUIRED", 400);
    }

    return z.string().uuid().parse(jobId.trim());
  }
}
