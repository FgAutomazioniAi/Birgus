import { FastifyReply } from "fastify";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";
import { StartDdtProcessingCommand } from "../../modules/ddt-processing/dto/StartDdtProcessingCommand.js";
import { DdtProcessingService } from "../../modules/ddt-processing/services/DdtProcessingService.js";

export class DdtController {
  private readonly service: DdtProcessingService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: DdtProcessingService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public analyzeDocument = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DDT_PROCESSING);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DDT_PROCESS);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const documentId = this.getDocumentId(request);

      const queued = await this.service.queueAnalysis(
        new StartDdtProcessingCommand({
          workspaceId,
          documentId,
          requestedByUserId: userId,
        }),
      );

      reply.code(202).send({
        queued: true,
        workspaceId,
        documentId,
        ddtDocumentId: queued.ddtDocumentId,
        jobId: queued.jobId,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getDocumentId(request: AuthenticatedRequest): string {
    const documentId = (request.params as { documentId?: string }).documentId;

    if (!documentId || !documentId.trim()) {
      throw new AppError("Document ID is required.", "DDT_DOCUMENT_ID_REQUIRED", 400);
    }

    return documentId;
  }

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code, message: error.message });
      return;
    }

    reply.code(500).send({ code: "INTERNAL_ERROR", message: "Unexpected error." });
  }
}
