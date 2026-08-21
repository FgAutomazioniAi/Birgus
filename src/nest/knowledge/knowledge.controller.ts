import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { PrismaClientManager } from "../../database/PrismaClientManager.js";
import { AiProviderSettingsService } from "../../modules/ai-runtime/services/AiProviderSettingsService.js";
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

const analyzeDocumentSetSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(20),
  prompt: z.string().max(10_000).optional(),
  knowledgeMode: z.enum(["on_demand", "saved", "hybrid"]).optional(),
  useDeepReasoning: z.boolean().optional(),
});

@Controller("/api/knowledge")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.DOCUMENT_INTELLIGENCE)
export class NestKnowledgeController {
  public constructor(
    @Inject(DocumentIntelligenceService)
    private readonly service: DocumentIntelligenceService,
    @Inject(AiProviderSettingsService)
    private readonly aiProviderSettingsService: AiProviderSettingsService,
  ) {}

  @Post("documents/:documentId/refresh")
  @HttpCode(200)
  @RequirePermission(PermissionKey.KNOWLEDGE_WRITE)
  public async refreshDocument(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    refreshDocumentParamsSchema.parse(paramsRaw);
    void requestContext;
    throw new AppError(
      "Refresh knowledge disponibile solo come nodo workflow.",
      "KNOWLEDGE_REFRESH_REQUIRES_WORKFLOW",
      409,
    );
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

  @Post("document-set/analyze")
  @HttpCode(200)
  @RequirePermission(PermissionKey.KNOWLEDGE_READ)
  public async analyzeDocumentSet(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = analyzeDocumentSetSchema.parse(bodyRaw);
    return this.service.analyzeDocumentSet({
      workspaceId: requestContext.workspace.workspaceId,
      documentIds: body.documentIds,
      prompt: body.prompt ?? "",
      knowledgeMode: body.knowledgeMode,
      useDeepReasoning: body.useDeepReasoning === true,
      aiProvider: await this.buildPythonAiProviderOverride(),
    });
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

  private async buildPythonAiProviderOverride(): Promise<Record<string, unknown> | null> {
    const config = await this.aiProviderSettingsService.getRuntimeConfig();
    const override: Record<string, unknown> = {};
    if (typeof config.baseUrl === "string" && config.baseUrl.trim()) {
      override.base_url = config.baseUrl.trim();
    }
    if (typeof config.chatModel === "string" && config.chatModel.trim()) {
      override.chat_model = config.chatModel.trim();
    }
    if (Number.isFinite(config.temperature)) {
      override.temperature = config.temperature;
    }
    if (typeof config.timeoutMs === "number" && Number.isFinite(config.timeoutMs) && config.timeoutMs > 0) {
      override.timeout_ms = Math.trunc(config.timeoutMs);
    }
    return Object.keys(override).length > 0 ? override : null;
  }
}
