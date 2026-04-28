import { FastifyReply } from "fastify";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { PrismaClientManager } from "../../database/PrismaClientManager.js";
import { FileKind, FileKindValue } from "../../modules/document-archive/domain/FileKind.js";
import { PutProjectFileCommand } from "../../modules/document-archive/dto/PutProjectFileCommand.js";
import { DocumentArchiveService } from "../../modules/document-archive/services/DocumentArchiveService.js";
import { LegacyQuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/LegacyQuotationOrchestratorService.js";
import { ProjectService } from "../../modules/projects/services/ProjectService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";
import { MultipartFormReader } from "../utils/MultipartFormReader.js";

const QUOTATION_FILE_NAME = "preventivo.pdf";

const FILE_KIND_META: Record<FileKindValue, { defaultFileName: string; extension: string; contentType: string }> = {
  "email-pdf": {
    defaultFileName: "email.pdf",
    extension: "pdf",
    contentType: "application/pdf",
  },
  "quotation-docx": {
    defaultFileName: "preventivo.docx",
    extension: "docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  "quotation-pdf": {
    defaultFileName: "preventivo.pdf",
    extension: "pdf",
    contentType: "application/pdf",
  },
  "quotation-xlsx": {
    defaultFileName: "preventivo.xlsx",
    extension: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  "tech-pdf": {
    defaultFileName: "specifica-tecnica.pdf",
    extension: "pdf",
    contentType: "application/pdf",
  },
};

export class LegacyProjectAssetsController {
  private readonly documentArchiveService: DocumentArchiveService;
  private readonly projectService: ProjectService;
  private readonly orchestratorService: LegacyQuotationOrchestratorService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(
    documentArchiveService: DocumentArchiveService,
    projectService: ProjectService,
    orchestratorService: LegacyQuotationOrchestratorService,
    moduleGuard: ModuleGuard,
    permissionGuard: PermissionGuard,
  ) {
    this.documentArchiveService = documentArchiveService;
    this.projectService = projectService;
    this.orchestratorService = orchestratorService;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public listProjectFiles = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        this.extractQueryVersion(request),
      );

      const prisma = PrismaClientManager.getClient();
      const versionPathPrefix = `/documents/${projectId}/${versionLabel}/`;
      const rows = await prisma.document.findMany({
        where: {
          workspace_id: workspaceId,
          deleted_at: null,
          node: {
            workspace_id: workspaceId,
            deleted_at: null,
            path_cache: {
              startsWith: versionPathPrefix,
            },
          },
        },
        select: {
          id: true,
          filename: true,
          size_bytes: true,
          storage_path: true,
          created_at: true,
          node: {
            select: {
              path_cache: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      });

      reply.code(200).send({
        files: rows.map((item) => ({
          createdAt: item.created_at.toISOString(),
          fileName: item.filename,
          kind: this.extractKindFromPath(item.node.path_cache),
          size: this.toNullableNumber(item.size_bytes),
          storagePath: item.storage_path,
          uuid: item.id,
          versionLabel,
        })),
        projectUuid: projectId,
        versionLabel,
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
      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        this.extractQueryVersion(request),
      );

      const document = await this.documentArchiveService.getCurrentProjectVersionFile({
        workspaceId,
        projectId,
        versionLabel,
        fileKind,
      });

      if (!document) {
        reply.code(200).send({
          found: false,
          kind: fileKind,
          versionLabel,
        });
        return;
      }

      reply.code(200).send({
        fileName: document.filename ?? FILE_KIND_META[fileKind].defaultFileName,
        found: true,
        kind: fileKind,
        previewUrl: `/api/projects/${projectId}/files/${fileKind}/content?version=${encodeURIComponent(versionLabel)}`,
        size: document.sizeBytes,
        storagePath: document.storagePath,
        versionLabel,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public putProjectFile = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const projectId = this.getProjectId(request);
      const fileKind = this.getFileKind(request);
      const meta = FILE_KIND_META[fileKind];

      const multipart = await MultipartFormReader.read(request);
      const uploaded = multipart.files.find((item) => item.fieldName === "file") ?? multipart.files[0];
      if (!uploaded) {
        throw new AppError("File mancante.", "FILE_REQUIRED", 400);
      }

      if (!this.isAllowedFileByKind(uploaded.fileName, meta.extension)) {
        throw new AppError(`Formato non valido: atteso .${meta.extension}`, "FILE_EXTENSION_INVALID", 400);
      }

      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        multipart.fields.versionLabel ?? this.extractQueryVersion(request),
      );

      const saved = await this.documentArchiveService.putProjectVersionFile(
        new PutProjectFileCommand({
          workspaceId,
          projectId,
          versionLabel,
          fileKind,
          fileName: uploaded.fileName || meta.defaultFileName,
          contentType: uploaded.mimeType || meta.contentType,
          bytes: uploaded.bytes,
          uploadedByUserId: userId,
        }),
      );

      reply.code(200).send({
        fileName: saved.filename,
        kind: fileKind,
        ok: true,
        storagePath: saved.storagePath,
        uploadedBy: userId,
        versionLabel,
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
      const fileKind = this.getFileKind(request);
      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        this.extractQueryVersion(request),
      );

      const existing = await this.documentArchiveService.getCurrentProjectVersionFile({
        workspaceId,
        projectId,
        versionLabel,
        fileKind,
      });

      if (!existing) {
        reply.code(200).send({ ok: true, removed: false });
        return;
      }

      const removed = await this.documentArchiveService.deleteProjectVersionFile({
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

  public getProjectFileContent = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const fileKind = this.getFileKind(request);
      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        this.extractQueryVersion(request),
      );

      const payload = await this.documentArchiveService.getProjectVersionFileBinary({
        workspaceId,
        projectId,
        versionLabel,
        fileKind,
      });

      if (!payload) {
        reply.code(404).send({ message: "File non trovato." });
        return;
      }

      reply
        .header("Content-Disposition", `inline; filename=\"${payload.document.filename ?? FILE_KIND_META[fileKind].defaultFileName}\"`)
        .header("Content-Type", payload.contentType ?? FILE_KIND_META[fileKind].contentType)
        .send(payload.bytes);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getQuotation = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        this.extractQueryVersion(request),
      );

      const document = await this.documentArchiveService.getCurrentProjectVersionFile({
        workspaceId,
        projectId,
        versionLabel,
        fileKind: FileKind.QUOTATION_PDF,
      });

      if (!document) {
        reply.code(200).send({ found: false });
        return;
      }

      reply.code(200).send({
        fileName: document.filename ?? QUOTATION_FILE_NAME,
        found: true,
        previewUrl: `/api/projects/${projectId}/quotation/file?version=${encodeURIComponent(versionLabel)}`,
        size: document.sizeBytes,
        storagePath: document.storagePath,
        versionLabel,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public postQuotation = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const projectId = this.getProjectId(request);
      await this.projectService.getProject(workspaceId, projectId);

      const multipart = await MultipartFormReader.read(request);
      const uploaded = multipart.files.find((item) => item.fieldName === "file") ?? multipart.files[0];
      if (!uploaded) {
        throw new AppError("File mancante.", "FILE_REQUIRED", 400);
      }

      if (!this.isPdfFile(uploaded.fileName, uploaded.mimeType)) {
        throw new AppError("E' consentito solo il formato PDF.", "FILE_EXTENSION_INVALID", 400);
      }

      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        this.extractQueryVersion(request),
      );

      const saved = await this.documentArchiveService.putProjectVersionFile(
        new PutProjectFileCommand({
          workspaceId,
          projectId,
          versionLabel,
          fileKind: FileKind.QUOTATION_PDF,
          fileName: QUOTATION_FILE_NAME,
          contentType: "application/pdf",
          bytes: uploaded.bytes,
          uploadedByUserId: userId,
        }),
      );

      let orchestratorJobId: string | null = null;
      try {
        orchestratorJobId = await this.orchestratorService.queueJob({
          workspaceId,
          projectId,
          versionLabel,
          requestedByUserId: userId,
          clientName: await this.resolveClientName(workspaceId, projectId, versionLabel),
        });
      } catch {
        orchestratorJobId = null;
      }

      reply.code(200).send({
        filename: QUOTATION_FILE_NAME,
        ok: true,
        orchestratorJobId,
        storagePath: saved.storagePath,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public deleteQuotation = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      await this.projectService.getProject(workspaceId, projectId);

      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        this.extractQueryVersion(request),
      );

      const existing = await this.documentArchiveService.getCurrentProjectVersionFile({
        workspaceId,
        projectId,
        versionLabel,
        fileKind: FileKind.QUOTATION_PDF,
      });

      if (!existing) {
        reply.code(200).send({ ok: true, removed: false });
        return;
      }

      await this.documentArchiveService.deleteProjectVersionFile({
        workspaceId,
        projectId,
        versionLabel,
        fileKind: FileKind.QUOTATION_PDF,
      });

      reply.code(200).send({ ok: true, removed: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getQuotationFile = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        this.extractQueryVersion(request),
      );

      const payload = await this.documentArchiveService.getProjectVersionFileBinary({
        workspaceId,
        projectId,
        versionLabel,
        fileKind: FileKind.QUOTATION_PDF,
      });

      if (!payload) {
        reply.code(404).send({ message: "File non trovato." });
        return;
      }

      reply
        .header("Content-Disposition", `inline; filename=\"${payload.document.filename ?? QUOTATION_FILE_NAME}\"`)
        .header("Content-Type", payload.contentType ?? "application/pdf")
        .send(payload.bytes);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public analyzeQuotation = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.DOCUMENT_ARCHIVE);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.DOCUMENTS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const projectId = this.getProjectId(request);
      await this.projectService.getProject(workspaceId, projectId);

      const versionLabel = await this.resolveVersionLabel(
        workspaceId,
        projectId,
        this.extractQueryVersion(request),
      );

      const quotation = await this.documentArchiveService.getCurrentProjectVersionFile({
        workspaceId,
        projectId,
        versionLabel,
        fileKind: FileKind.QUOTATION_PDF,
      });

      if (!quotation) {
        throw new AppError("PDF preventivo non trovato per questo progetto.", "QUOTATION_FILE_NOT_FOUND", 404);
      }

      if (!quotation.storagePath.startsWith("garage://")) {
        throw new AppError("PDF preventivo non migrato su Garage. Eseguire la migrazione storage.", "QUOTATION_NOT_GARAGE", 409);
      }

      let jobId: string;
      try {
        jobId = await this.orchestratorService.queueJob({
          workspaceId,
          projectId,
          versionLabel,
          requestedByUserId: userId,
          clientName: await this.resolveClientName(workspaceId, projectId, versionLabel),
        });
      } catch {
        throw new AppError("Servizio orchestratore non raggiungibile.", "ORCHESTRATOR_UNAVAILABLE", 503);
      }

      reply.code(200).send({
        jobId,
        ok: true,
      });
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
      throw new AppError("Tipo file non supportato.", "FILE_KIND_INVALID", 400);
    }

    return value as FileKindValue;
  }

  private extractQueryVersion(request: AuthenticatedRequest): string | null {
    const query = request.query as { version?: string };
    const value = query.version;
    if (!value || !value.trim()) {
      return null;
    }

    return value.trim();
  }

  private async resolveVersionLabel(
    workspaceId: string,
    projectId: string,
    explicitVersionLabel: string | null | undefined,
  ): Promise<string> {
    if (explicitVersionLabel && explicitVersionLabel.trim()) {
      return this.normalizeVersionLabel(explicitVersionLabel);
    }

    const versions = await this.projectService.listProjectVersions(workspaceId, projectId);
    const defaultVersion = versions.find((item) => item.isDefault) ?? versions[0] ?? null;

    return this.normalizeVersionLabel(defaultVersion?.versionLabel ?? "v1");
  }

  private normalizeVersionLabel(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-");

    return normalized || "v1";
  }

  private extractKindFromPath(pathCache: string | null): string | null {
    if (!pathCache) {
      return null;
    }

    const parts = pathCache.split("/").filter(Boolean);
    if (parts.length < 4) {
      return null;
    }

    return parts[parts.length - 1] ?? null;
  }

  private isAllowedFileByKind(fileName: string, extension: string): boolean {
    return fileName.toLowerCase().endsWith(`.${extension.toLowerCase()}`);
  }

  private isPdfFile(fileName: string, mimeType: string): boolean {
    return mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  }

  private toNullableNumber(value: bigint | null): number | null {
    if (value === null) {
      return null;
    }

    return Number(value);
  }

  private async resolveClientName(
    workspaceId: string,
    projectId: string,
    versionLabel: string,
  ): Promise<string | null> {
    const versions = await this.projectService.listProjectVersions(workspaceId, projectId);
    const targetVersion = versions.find((item) => item.versionLabel === versionLabel)
      ?? versions.find((item) => item.isDefault)
      ?? versions[0]
      ?? null;

    return targetVersion?.clientName ?? null;
  }

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ message: error.message, code: error.code });
      return;
    }

    console.error("[LegacyProjectAssetsController] Unexpected error", error);
    reply.code(500).send({ message: "Errore interno." });
  }
}
