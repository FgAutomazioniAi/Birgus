import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { PrismaClientManager } from "../../database/PrismaClientManager.js";
import { DocumentIntelligenceService } from "../../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

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

export class KnowledgeController {
  private readonly service: DocumentIntelligenceService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: DocumentIntelligenceService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public refreshDocument = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_INTELLIGENCE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.KNOWLEDGE_WRITE);

      const { documentId } = refreshDocumentParamsSchema.parse(request.params);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const document = await this.service.refreshDocumentKnowledge(workspaceId, documentId);

      reply.code(200).send({
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
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public search = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_INTELLIGENCE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.KNOWLEDGE_READ);

      const query = searchQuerySchema.parse(request.query);
      const workspaceId = request.requestContext.workspace.workspaceId;
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

      reply.code(200).send({
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
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getQuotationContext = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_INTELLIGENCE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.KNOWLEDGE_READ);
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_READ);
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_READ);

      const { projectId, versionLabel } = quotationContextParamsSchema.parse(request.params);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const context = await this.service.getProjectVersionQuotationContext({
        workspaceId,
        projectId,
        versionLabel,
      });

      reply.code(200).send(context);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

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

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof z.ZodError) {
      reply.code(400).send({ code: "VALIDATION_ERROR", message: "Invalid payload.", issues: error.issues });
      return;
    }

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code, message: error.message });
      return;
    }

    reply.code(500).send({ code: "INTERNAL_ERROR", message: "Unexpected error." });
  }
}
