import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import {
  ArchivePackageKey,
  ArchivedItemsService,
} from "../../modules/document-archive/services/ArchivedItemsService.js";
import { ActiveDocumentsService } from "../../modules/document-archive/services/ActiveDocumentsService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const listArchiveQuerySchema = z.object({
  package: z.enum(["complete", "projects"]).optional(),
});

const listDocumentsQuerySchema = z.object({
  container: z.enum(["all", "modules", "playgrounds"]).optional(),
  query: z.string().max(200).optional(),
  knowledge: z.enum(["all", "indexed", "not_indexed"]).optional(),
});

const documentParamsSchema = z.object({
  documentId: z.string().uuid(),
});

const archiveParamsSchema = z.object({
  entityType: z.enum(["project", "project_version", "document"]),
  entityId: z.string().min(1),
});

const permanentDeleteBodySchema = z.object({
  confirmText: z.string().min(1),
});

const emptyTrashBodySchema = z.object({
  confirmText: z.string().min(1),
});

@Controller("/api/archive")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
export class NestDocumentArchiveController {
  public constructor(
    @Inject(ArchivedItemsService)
    private readonly service: ArchivedItemsService,
    @Inject(ActiveDocumentsService)
    private readonly activeDocumentsService: ActiveDocumentsService,
  ) {}

  @Get("documents")
  @RequirePermission(PermissionKey.DOCUMENTS_READ)
  public async listDocuments(
    @Query() queryRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    const query = listDocumentsQuerySchema.parse(queryRaw);
    return this.activeDocumentsService.listDocuments({
      workspaceId: requestContext.workspace.workspaceId,
      container: query.container ?? "all",
      query: query.query,
      knowledge: query.knowledge ?? "all",
    });
  }

  @Delete("documents/:documentId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.DOCUMENTS_WRITE)
  public async deleteDocument(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<{ ok: true }> {
    const { documentId } = documentParamsSchema.parse(paramsRaw);
    await this.activeDocumentsService.deleteDocument({
      workspaceId: requestContext.workspace.workspaceId,
      documentId,
    });
    return { ok: true };
  }

  @Delete("empty")
  @HttpCode(200)
  @RequirePermission(PermissionKey.DOCUMENTS_WRITE)
  public async emptyTrash(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<{ ok: true }> {
    const body = emptyTrashBodySchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "svuota") {
      throw new AppError("Conferma eliminazione non valida: digita 'svuota'.", "DELETE_CONFIRMATION_INVALID", 400);
    }
    await this.service.emptyTrash(requestContext.workspace.workspaceId);
    return { ok: true };
  }

  @Get()
  @RequirePermission(PermissionKey.DOCUMENTS_READ)
  public async listItems(
    @Query() queryRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    const query = listArchiveQuerySchema.parse(queryRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const packageKey = (query.package ?? "complete") as ArchivePackageKey;

    return this.service.listArchivedItems({
      workspaceId,
      packageKey,
    });
  }

  @Post(":entityType/:entityId/restore")
  @HttpCode(200)
  @RequirePermission(PermissionKey.DOCUMENTS_WRITE)
  public async restoreItem(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<{ ok: true }> {
    const params = archiveParamsSchema.parse(paramsRaw);
    const workspaceId = requestContext.workspace.workspaceId;

    await this.service.restoreArchivedItem({
      workspaceId,
      entityType: params.entityType,
      entityId: params.entityId.trim(),
    });

    return { ok: true };
  }

  @Delete(":entityType/:entityId/permanent")
  @HttpCode(200)
  @RequirePermission(PermissionKey.DOCUMENTS_WRITE)
  public async permanentlyDeleteItem(
    @Param() paramsRaw: unknown,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<{ ok: true }> {
    const params = archiveParamsSchema.parse(paramsRaw);
    const body = permanentDeleteBodySchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const workspaceId = requestContext.workspace.workspaceId;
    await this.service.permanentlyDeleteArchivedItem({
      workspaceId,
      entityType: params.entityType,
      entityId: params.entityId.trim(),
    });

    return { ok: true };
  }
}
