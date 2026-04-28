import { FastifyReply } from "fastify";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { LegacyDdtReaderService } from "../../modules/ddt-processing/services/LegacyDdtReaderService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";
import { MultipartFormReader } from "../utils/MultipartFormReader.js";

export class LegacyDdtReaderController {
  private readonly service: LegacyDdtReaderService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: LegacyDdtReaderService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public getConfig = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DDT_PROCESSING);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DDT_READ);

      reply.code(200).send(this.service.getConfig());
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listDocuments = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DDT_PROCESSING);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DDT_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const documents = await this.service.listDocuments(workspaceId);
      reply.code(200).send(documents);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public uploadDocument = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DDT_PROCESSING);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DDT_PROCESS);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;

      const multipart = await MultipartFormReader.read(request);
      const uploaded = multipart.files.find((item) => item.fieldName === "file") ?? multipart.files[0];
      if (!uploaded) {
        throw new AppError("File mancante.", "DDT_FILE_REQUIRED", 400);
      }

      if (!this.isPdfFile(uploaded.fileName, uploaded.mimeType)) {
        throw new AppError("Sono accettati solo file PDF.", "DDT_FILE_EXTENSION_INVALID", 400);
      }

      const created = await this.service.uploadDocument({
        workspaceId,
        requestedByUserId: userId,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        bytes: uploaded.bytes,
      });

      reply.code(200).send(created);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getDocument = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DDT_PROCESSING);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DDT_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const documentId = this.getDocumentId(request);

      const document = await this.service.getDocument(workspaceId, documentId);
      if (!document) {
        reply.code(404).send({ message: "Documento non trovato." });
        return;
      }

      reply.code(200).send(document);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public analyzeDocument = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DDT_PROCESSING);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DDT_PROCESS);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const documentId = this.getDocumentId(request);

      const queued = await this.service.queueAnalyze({
        workspaceId,
        requestedByUserId: userId,
        ddtDocumentId: documentId,
      });

      reply.code(200).send({
        queued: queued.queued,
        doc_id: queued.docId,
        status: queued.status,
        job_id: queued.jobId,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public deleteDocument = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DDT_PROCESSING);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DDT_PROCESS);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const documentId = this.getDocumentId(request);

      const deleted = await this.service.deleteDocument(workspaceId, documentId);
      reply.code(200).send({
        deleted,
        doc_id: documentId,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getDocumentFile = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DDT_PROCESSING);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DDT_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const documentId = this.getDocumentId(request);

      const file = await this.service.getDocumentFile({
        workspaceId,
        ddtDocumentId: documentId,
      });

      if (!file) {
        reply.code(404).send({ message: "Documento non trovato." });
        return;
      }

      reply
        .header("content-type", file.contentType)
        .header("content-disposition", `inline; filename=\"${file.fileName}\"`)
        .header("cache-control", "no-store")
        .send(file.bytes);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getDocumentId(request: AuthenticatedRequest): string {
    const value = (request.params as { id?: string }).id;
    if (!value || !value.trim()) {
      throw new AppError("ID documento non valido.", "DDT_DOCUMENT_ID_INVALID", 400);
    }

    return value.trim();
  }

  private isPdfFile(fileName: string, mimeType: string): boolean {
    return mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  }

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ message: error.message, code: error.code });
      return;
    }

    console.error("[LegacyDdtReaderController] Unexpected error", error);
    reply.code(500).send({ message: "Errore interno." });
  }
}
