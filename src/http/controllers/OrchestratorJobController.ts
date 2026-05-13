import { FastifyReply } from "fastify";
import { z } from "zod";

import { AppError } from "../../core/errors/AppError.js";
import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

export class OrchestratorJobController {
  private readonly orchestratorService: QuotationOrchestratorService;

  public constructor(orchestratorService: QuotationOrchestratorService) {
    this.orchestratorService = orchestratorService;
  }

  public getJob = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      const jobId = this.getJobId(request);
      const job = await this.orchestratorService.getJob(jobId);

      if (!job) {
        reply.code(404).send({ message: "Job non trovato." });
        return;
      }

      reply.code(200).send(job);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getJobId(request: AuthenticatedRequest): string {
    const value = (request.params as { jobId?: string }).jobId;
    if (!value || !value.trim()) {
      throw new AppError("Job ID mancante.", "ORCHESTRATOR_JOB_ID_REQUIRED", 400);
    }

    return z.string().uuid().parse(value.trim());
  }

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof z.ZodError) {
      reply.code(400).send({ message: "Job ID non valido.", code: "ORCHESTRATOR_JOB_ID_INVALID" });
      return;
    }

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ message: error.message, code: error.code });
      return;
    }

    reply.code(500).send({ message: "Errore interno." });
  }
}
