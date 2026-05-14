import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import {
  ArchivePackageKey,
  ArchivedItemsService,
} from "../../modules/document-archive/services/ArchivedItemsService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const listArchiveQuerySchema = z.object({
  package: z.enum(["complete", "projects"]).optional(),
});

const archiveParamsSchema = z.object({
  entityType: z.enum(["project", "project_version", "shipment", "document"]),
  entityId: z.string().min(1),
});

const permanentDeleteBodySchema = z.object({
  confirmText: z.string().min(1),
});

export class ArchiveController {
  private readonly service: ArchivedItemsService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: ArchivedItemsService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public listItems = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_READ);

      const query = listArchiveQuerySchema.parse(request.query);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const packageKey = (query.package ?? "complete") as ArchivePackageKey;

      const view = await this.service.listArchivedItems({
        workspaceId,
        packageKey,
      });

      reply.code(200).send(view);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public restoreItem = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_WRITE);

      const params = archiveParamsSchema.parse(request.params);
      const workspaceId = request.requestContext.workspace.workspaceId;

      await this.service.restoreArchivedItem({
        workspaceId,
        entityType: params.entityType,
        entityId: params.entityId.trim(),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public permanentlyDeleteItem = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_WRITE);

      const params = archiveParamsSchema.parse(request.params);
      const body = permanentDeleteBodySchema.parse(request.body);
      if (body.confirmText.trim() !== "cancella") {
        throw new AppError(
          "Conferma eliminazione non valida: digita 'cancella'.",
          "DELETE_CONFIRMATION_INVALID",
          400,
        );
      }
      const workspaceId = request.requestContext.workspace.workspaceId;

      await this.service.permanentlyDeleteArchivedItem({
        workspaceId,
        entityType: params.entityType,
        entityId: params.entityId.trim(),
      });

      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

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
