import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";
import { DocumentArchiveService } from "../../modules/document-archive/services/DocumentArchiveService.js";
import { FileKind, FileKindValue } from "../../modules/document-archive/domain/FileKind.js";
import { PutProjectFileCommand } from "../../modules/document-archive/dto/PutProjectFileCommand.js";

const putFileSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  contentBase64: z.string().min(1),
  versionLabel: z.string().min(1).optional(),
});

export class DocumentController {
  private readonly service: DocumentArchiveService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: DocumentArchiveService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public listProjectFiles = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const versionLabel = this.getVersionLabelFromQuery(request);

      const files = await this.service.listProjectVersionFiles({
        workspaceId,
        projectId,
        versionLabel,
      });

      reply.code(200).send({
        workspaceId,
        projectId,
        versionLabel,
        files: files.map((item) => ({
          id: item.id,
          fileName: item.filename,
          sizeBytes: item.sizeBytes,
          storagePath: item.storagePath,
          createdAt: item.createdAt,
        })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getProjectFileMetadata = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const fileKind = this.getFileKind(request);
      const versionLabel = this.getVersionLabelFromQuery(request);

      const file = await this.service.getCurrentProjectVersionFile({
        workspaceId,
        projectId,
        fileKind,
        versionLabel,
      });

      if (!file) {
        reply.code(404).send({ code: "FILE_NOT_FOUND", message: "File not found." });
        return;
      }

      reply.code(200).send({
        id: file.id,
        fileName: file.filename,
        sizeBytes: file.sizeBytes,
        storagePath: file.storagePath,
        createdAt: file.createdAt,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public putProjectFile = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_WRITE);

      const body = putFileSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const projectId = this.getProjectId(request);
      const fileKind = this.getFileKind(request);
      const versionLabel = body.versionLabel?.trim() || this.getVersionLabelFromQuery(request);

      const bytes = Buffer.from(body.contentBase64, "base64");
      if (bytes.length === 0) {
        throw new AppError("File payload is empty.", "FILE_EMPTY", 400);
      }

      const saved = await this.service.putProjectVersionFile(
        new PutProjectFileCommand({
          workspaceId,
          projectId,
          versionLabel,
          fileKind,
          fileName: body.fileName,
          contentType: body.contentType,
          bytes,
          uploadedByUserId: userId,
        }),
      );

      reply.code(200).send({
        id: saved.id,
        fileName: saved.filename,
        sizeBytes: saved.sizeBytes,
        storagePath: saved.storagePath,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public deleteProjectFile = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const versionLabel = this.getVersionLabelFromQuery(request);
      const fileKind = this.getFileKind(request);

      const removed = await this.service.deleteProjectVersionFile({
        workspaceId,
        projectId,
        versionLabel,
        fileKind,
      });

      reply.code(200).send({ ok: true, removed });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getProjectId(request: AuthenticatedRequest): string {
    const value = (request.params as { projectId?: string }).projectId;

    if (!value || !value.trim()) {
      throw new AppError("Project ID is required.", "PROJECT_ID_REQUIRED", 400);
    }

    return value;
  }

  private getFileKind(request: AuthenticatedRequest): FileKindValue {
    const value = (request.params as { fileKind?: string }).fileKind;

    if (!value || !FileKind.ALL.includes(value as FileKindValue)) {
      throw new AppError("Unsupported file kind.", "FILE_KIND_INVALID", 400);
    }

    return value as FileKindValue;
  }

  private getVersionLabelFromQuery(request: AuthenticatedRequest): string {
    const query = request.query as { version?: string };
    return query.version?.trim().toLowerCase() || "v1";
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
