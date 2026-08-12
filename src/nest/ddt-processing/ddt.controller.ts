import { Controller, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { StartDdtProcessingCommand } from "../../modules/ddt-processing/dto/StartDdtProcessingCommand.js";
import { DdtProcessingService } from "../../modules/ddt-processing/services/DdtProcessingService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

@Controller("/api/ddt")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.DDT_PROCESSING)
export class NestDdtController {
  public constructor(
    @Inject(DdtProcessingService)
    private readonly service: DdtProcessingService,
  ) {}

  @Post("documents/:documentId/analyze")
  @HttpCode(202)
  @RequirePermission(PermissionKey.DDT_PROCESS)
  public async analyzeDocument(
    @Param("documentId") documentIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const documentId = this.getDocumentId(documentIdRaw);
    const queued = await this.service.queueAnalysis(
      new StartDdtProcessingCommand({
        workspaceId,
        documentId,
        requestedByUserId: userId,
      }),
    );

    return {
      queued: true,
      workspaceId,
      documentId,
      ddtDocumentId: queued.ddtDocumentId,
      jobId: queued.jobId,
    };
  }

  private getDocumentId(documentId: string): string {
    if (!documentId || !documentId.trim()) {
      throw new AppError("Document ID is required.", "DDT_DOCUMENT_ID_REQUIRED", 400);
    }

    return documentId.trim();
  }
}
