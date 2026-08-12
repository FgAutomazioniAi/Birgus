import { Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { PrismaClientManager } from "../../database/PrismaClientManager.js";
import { DocumentIntelligenceService } from "../../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const refreshDocumentParamsSchema = z.object({
  documentId: z.string().uuid(),
});

const quotationContextParamsSchema = z.object({
  projectId: z.string().uuid(),
  versionLabel: z.string().min(1),
});

const searchQuerySchema = z.object({
  query: z.string().min(2),
  topK: z.coerce.number().int().positive().max(10).optional(),
  mode: z.enum(["semantic", "targeted"]).optional(),
  moduleKey: z.string().min(1).optional(),
  sourceEntityType: z.string().min(1).optional(),
  sourceEntityId: z.string().min(1).optional(),
});

@Controller("/api/knowledge")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.DOCUMENT_INTELLIGENCE)
export class NestKnowledgeController {
  public constructor(
    @Inject(DocumentIntelligenceService)
    private readonly service: DocumentIntelligenceService,
  ) {}

  @Post("documents/:documentId/refresh")
  @HttpCode(200)
  @RequirePermission(PermissionKey.KNOWLEDGE_WRITE)
  public async refreshDocument(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { documentId } = refreshDocumentParamsSchema.parse(paramsRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const document = await this.service.refreshDocumentKnowledge(workspaceId, documentId);

    return {
      knowledgeDocument: {
        id: document.id,
        workspaceId: document.workspaceId,
        documentId: document.documentId,
        moduleId: document.moduleId,
        sourceEntityType: document.sourceEntityType,
        sourceEntityId: document.sourceEntityId,
        representationKey: document.representationKey,
        title: document.title,
        summaryText: document.summaryText,
        extractionStatus: document.extractionStatus,
        extractionKind: document.extractionKind,
        extractedAt: document.extractedAt,
        updatedAt: document.updatedAt,
      },
    };
  }

  @Get("search")
  @RequirePermission(PermissionKey.KNOWLEDGE_READ)
  public async search(
    @Query() queryRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const query = searchQuerySchema.parse(queryRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const moduleId = await this.resolveModuleId(query.moduleKey ?? null);
    const mode = query.mode ?? "semantic";
    const hits = mode === "targeted"
      ? await this.service.searchWorkspaceKnowledgeByKeyword({
        workspaceId,
        query: query.query,
        topK: query.topK,
        moduleId,
        sourceEntityType: query.sourceEntityType ?? null,
        sourceEntityId: query.sourceEntityId ?? null,
      })
      : await this.service.searchWorkspaceKnowledge({
        workspaceId,
        query: query.query,
        topK: query.topK,
        moduleId,
        sourceEntityType: query.sourceEntityType ?? null,
        sourceEntityId: query.sourceEntityId ?? null,
      });

    return {
      workspaceId,
      mode,
      query: query.query,
      hits: hits.map((hit) => ({
        chunkId: hit.chunkId,
        knowledgeDocumentId: hit.knowledgeDocumentId,
        documentId: hit.documentId,
        sourceEntityType: hit.sourceEntityType,
        sourceEntityId: hit.sourceEntityId,
        title: hit.title,
        sourceLabel: hit.sourceLabel,
        chunkIndex: hit.chunkIndex,
        contentText: hit.contentText,
        distance: hit.distance,
      })),
    };
  }

  @Get("projects/:projectId/versions/:versionLabel/quotation-context")
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE, ModuleKey.PROJECT_MANAGEMENT)
  @RequirePermission(PermissionKey.KNOWLEDGE_READ, PermissionKey.DOCUMENTS_READ, PermissionKey.PROJECTS_READ)
  public async getQuotationContext(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    const { projectId, versionLabel } = quotationContextParamsSchema.parse(paramsRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    return this.service.getProjectVersionQuotationContext({
      workspaceId,
      projectId,
      versionLabel,
    });
  }

  private async resolveModuleId(moduleKey: string | null): Promise<number | null> {
    if (!moduleKey?.trim()) {
      return null;
    }

    const prisma = PrismaClientManager.getClient();
    const row = await prisma.module.findFirst({
      where: {
        key: moduleKey.trim(),
        is_active: true,
      },
      select: {
        id: true,
      },
    });

    if (!row) {
      throw new AppError(`Modulo '${moduleKey}' non trovato.`, "KNOWLEDGE_MODULE_NOT_FOUND", 404);
    }

    return row.id;
  }
}
