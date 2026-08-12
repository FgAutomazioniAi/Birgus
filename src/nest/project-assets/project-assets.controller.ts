import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { PrismaClientManager } from "../../database/PrismaClientManager.js";
import { FileKind, FileKindValue } from "../../modules/document-archive/domain/FileKind.js";
import { PutProjectFileCommand } from "../../modules/document-archive/dto/PutProjectFileCommand.js";
import { DocumentArchiveService } from "../../modules/document-archive/services/DocumentArchiveService.js";
import { ProjectService } from "../../modules/projects/services/ProjectService.js";
import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";
import { MultipartFormReader } from "../../shared/http/MultipartFormReader.js";

const QUOTATION_FILE_NAME = "preventivo.pdf";
const deleteConfirmationSchema = {
  parse: (value: unknown): { confirmText: string } => {
    if (!value || typeof value !== "object") {
      throw new AppError("Conferma eliminazione mancante.", "DELETE_CONFIRMATION_REQUIRED", 400);
    }
    const record = value as Record<string, unknown>;
    const confirmText = typeof record.confirmText === "string" ? record.confirmText.trim() : "";
    if (confirmText !== "cancella") {
      throw new AppError("Conferma eliminazione non valida: digita 'cancella'.", "DELETE_CONFIRMATION_INVALID", 400);
    }
    return { confirmText };
  },
};

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

@Controller("/api/projects/:projectId")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
export class NestProjectAssetsController {
  public constructor(
    @Inject(DocumentArchiveService)
    private readonly documentArchiveService: DocumentArchiveService,
    @Inject(ProjectService)
    private readonly projectService: ProjectService,
    @Inject(QuotationOrchestratorService)
    private readonly orchestratorService: QuotationOrchestratorService,
  ) {}

  @Get("files")
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_READ)
  public async listProjectFiles(
    @Param("projectId") projectIdRaw: string,
    @Query("version") versionRaw: string | undefined,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const versionLabel = await this.resolveVersionLabel(
      workspaceId,
      projectId,
      this.normalizeOptionalString(versionRaw),
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

    return {
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
    };
  }

  @Get("files/:fileKind")
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_READ)
  public async getProjectFileMetadata(
    @Param("projectId") projectIdRaw: string,
    @Param("fileKind") fileKindRaw: string,
    @Query("version") versionRaw: string | undefined,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const fileKind = this.getFileKind(fileKindRaw);
    const versionLabel = await this.resolveVersionLabel(
      workspaceId,
      projectId,
      this.normalizeOptionalString(versionRaw),
    );

    const document = await this.documentArchiveService.getCurrentProjectVersionFile({
      workspaceId,
      projectId,
      versionLabel,
      fileKind,
    });

    if (!document) {
      return {
        found: false,
        kind: fileKind,
        versionLabel,
      };
    }

    return {
      fileName: document.filename ?? FILE_KIND_META[fileKind].defaultFileName,
      found: true,
      kind: fileKind,
      previewUrl: `/api/projects/${projectId}/files/${fileKind}/content?version=${encodeURIComponent(versionLabel)}`,
      size: document.sizeBytes,
      storagePath: document.storagePath,
      versionLabel,
    };
  }

  @Post("files/:fileKind")
  @HttpCode(200)
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_WRITE)
  public async putProjectFile(
    @Param("projectId") projectIdRaw: string,
    @Param("fileKind") fileKindRaw: string,
    @Query("version") versionRaw: string | undefined,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const projectId = this.getProjectId(projectIdRaw);
    const fileKind = this.getFileKind(fileKindRaw);
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
      multipart.fields.versionLabel ?? this.normalizeOptionalString(versionRaw),
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

    return {
      fileName: saved.filename,
      kind: fileKind,
      ok: true,
      storagePath: saved.storagePath,
      uploadedBy: userId,
      versionLabel,
    };
  }

  @Delete("files/:fileKind")
  @HttpCode(200)
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_WRITE)
  public async deleteProjectFile(
    @Param("projectId") projectIdRaw: string,
    @Param("fileKind") fileKindRaw: string,
    @Query("version") versionRaw: string | undefined,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    deleteConfirmationSchema.parse(bodyRaw);

    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const fileKind = this.getFileKind(fileKindRaw);
    const versionLabel = await this.resolveVersionLabel(
      workspaceId,
      projectId,
      this.normalizeOptionalString(versionRaw),
    );

    const existing = await this.documentArchiveService.getCurrentProjectVersionFile({
      workspaceId,
      projectId,
      versionLabel,
      fileKind,
    });

    if (!existing) {
      return { ok: true, removed: false };
    }

    const removed = await this.documentArchiveService.deleteProjectVersionFile({
      workspaceId,
      projectId,
      versionLabel,
      fileKind,
    });

    return { ok: true, removed };
  }

  @Get("files/:fileKind/content")
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_READ)
  public async getProjectFileContent(
    @Param("projectId") projectIdRaw: string,
    @Param("fileKind") fileKindRaw: string,
    @Query("version") versionRaw: string | undefined,
    @CurrentRequestContext() requestContext: RequestContext,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const fileKind = this.getFileKind(fileKindRaw);
    const versionLabel = await this.resolveVersionLabel(
      workspaceId,
      projectId,
      this.normalizeOptionalString(versionRaw),
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
  }

  @Get("quotation")
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_READ)
  public async getQuotation(
    @Param("projectId") projectIdRaw: string,
    @Query("version") versionRaw: string | undefined,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const versionLabel = await this.resolveVersionLabel(
      workspaceId,
      projectId,
      this.normalizeOptionalString(versionRaw),
    );

    const document = await this.documentArchiveService.getCurrentProjectVersionFile({
      workspaceId,
      projectId,
      versionLabel,
      fileKind: FileKind.QUOTATION_PDF,
    });

    if (!document) {
      return { found: false };
    }

    return {
      fileName: document.filename ?? QUOTATION_FILE_NAME,
      found: true,
      previewUrl: `/api/projects/${projectId}/quotation/file?version=${encodeURIComponent(versionLabel)}`,
      size: document.sizeBytes,
      storagePath: document.storagePath,
      versionLabel,
    };
  }

  @Post("quotation")
  @HttpCode(200)
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_WRITE)
  public async postQuotation(
    @Param("projectId") projectIdRaw: string,
    @Query("version") versionRaw: string | undefined,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const projectId = this.getProjectId(projectIdRaw);
    await this.projectService.getProject(workspaceId, projectId);

    const multipart = await MultipartFormReader.read(request);
    const uploaded = multipart.files.find((item) => item.fieldName === "file") ?? multipart.files[0];
    if (!uploaded) {
      throw new AppError("File mancante.", "FILE_REQUIRED", 400);
    }

    if (!this.isPdfFile(uploaded.fileName, uploaded.mimeType, uploaded.bytes)) {
      throw new AppError("E' consentito solo il formato PDF.", "FILE_EXTENSION_INVALID", 400);
    }

    const versionLabel = await this.resolveVersionLabel(
      workspaceId,
      projectId,
      this.normalizeOptionalString(versionRaw),
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

    return {
      filename: QUOTATION_FILE_NAME,
      ok: true,
      orchestratorJobId,
      storagePath: saved.storagePath,
    };
  }

  @Delete("quotation")
  @HttpCode(200)
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_WRITE)
  public async deleteQuotation(
    @Param("projectId") projectIdRaw: string,
    @Query("version") versionRaw: string | undefined,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    deleteConfirmationSchema.parse(bodyRaw);

    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    await this.projectService.getProject(workspaceId, projectId);

    const versionLabel = await this.resolveVersionLabel(
      workspaceId,
      projectId,
      this.normalizeOptionalString(versionRaw),
    );

    const existing = await this.documentArchiveService.getCurrentProjectVersionFile({
      workspaceId,
      projectId,
      versionLabel,
      fileKind: FileKind.QUOTATION_PDF,
    });

    if (!existing) {
      return { ok: true, removed: false };
    }

    await this.documentArchiveService.deleteProjectVersionFile({
      workspaceId,
      projectId,
      versionLabel,
      fileKind: FileKind.QUOTATION_PDF,
    });

    return { ok: true, removed: true };
  }

  @Get("quotation/file")
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_READ)
  public async getQuotationFile(
    @Param("projectId") projectIdRaw: string,
    @Query("version") versionRaw: string | undefined,
    @CurrentRequestContext() requestContext: RequestContext,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const versionLabel = await this.resolveVersionLabel(
      workspaceId,
      projectId,
      this.normalizeOptionalString(versionRaw),
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
  }

  @Post("quotation/analyze")
  @HttpCode(200)
  @RequireModule(ModuleKey.DOCUMENT_ARCHIVE)
  @RequirePermission(PermissionKey.DOCUMENTS_WRITE)
  public async analyzeQuotation(
    @Param("projectId") projectIdRaw: string,
    @Query("version") versionRaw: string | undefined,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const projectId = this.getProjectId(projectIdRaw);
    await this.projectService.getProject(workspaceId, projectId);

    const versionLabel = await this.resolveVersionLabel(
      workspaceId,
      projectId,
      this.normalizeOptionalString(versionRaw),
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

    return {
      jobId,
      ok: true,
    };
  }

  private getProjectId(projectId: string): string {
    if (!projectId || !projectId.trim()) {
      throw new AppError("Project ID is required.", "PROJECT_ID_REQUIRED", 400);
    }

    return projectId.trim();
  }

  private getFileKind(fileKind: string): FileKindValue {
    if (!fileKind || !FileKind.ALL.includes(fileKind as FileKindValue)) {
      throw new AppError("Tipo file non supportato.", "FILE_KIND_INVALID", 400);
    }

    return fileKind as FileKindValue;
  }

  private normalizeOptionalString(value: string | null | undefined): string | null {
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

  private isPdfFile(fileName: string, mimeType: string, bytes: Buffer): boolean {
    const hasPdfNameOrMime = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
    return hasPdfNameOrMime && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
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
}
