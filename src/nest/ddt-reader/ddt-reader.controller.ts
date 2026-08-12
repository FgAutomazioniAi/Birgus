import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { DdtReaderService } from "../../modules/ddt-processing/services/DdtReaderService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";
import { MultipartFormReader } from "../../shared/http/MultipartFormReader.js";

const deleteDdtDocumentSchema = z.object({
  confirmText: z.string().min(1),
});

@Controller("/api/ddt-reader")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.DDT_PROCESSING)
export class NestDdtReaderController {
  public constructor(
    @Inject(DdtReaderService)
    private readonly service: DdtReaderService,
  ) {}

  @Get("config")
  @RequirePermission(PermissionKey.DDT_READ)
  public getConfig(): { single_document_mode: boolean; lm_model: string; lm_base_url: string } {
    return this.service.getConfig();
  }

  @Get("documents")
  @RequirePermission(PermissionKey.DDT_READ)
  public async listDocuments(
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    return this.service.listDocuments(requestContext.workspace.workspaceId);
  }

  @Post("documents")
  @HttpCode(200)
  @RequirePermission(PermissionKey.DDT_PROCESS)
  public async uploadDocument(
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const multipart = await MultipartFormReader.read(request);
    const uploaded = multipart.files.find((item) => item.fieldName === "file") ?? multipart.files[0];
    if (!uploaded) {
      throw new AppError("File mancante.", "DDT_FILE_REQUIRED", 400);
    }

    if (!this.isPdfFile(uploaded.fileName, uploaded.mimeType, uploaded.bytes)) {
      throw new AppError("Sono accettati solo file PDF.", "DDT_FILE_EXTENSION_INVALID", 400);
    }

    return this.service.uploadDocument({
      workspaceId,
      requestedByUserId: userId,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      bytes: uploaded.bytes,
    });
  }

  @Get("documents/:id")
  @RequirePermission(PermissionKey.DDT_READ)
  public async getDocument(
    @Param("id") documentIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    const workspaceId = requestContext.workspace.workspaceId;
    const documentId = this.getDocumentId(documentIdRaw);
    const document = await this.service.getDocument(workspaceId, documentId);
    if (!document) {
      throw new AppError("Documento non trovato.", "DDT_DOCUMENT_NOT_FOUND", 404);
    }

    return document;
  }

  @Post("documents/:id/analyze")
  @HttpCode(200)
  @RequirePermission(PermissionKey.DDT_PROCESS)
  public async analyzeDocument(
    @Param("id") documentIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const documentId = this.getDocumentId(documentIdRaw);
    const queued = await this.service.queueAnalyze({
      workspaceId,
      requestedByUserId: userId,
      ddtDocumentId: documentId,
    });

    return {
      queued: queued.queued,
      doc_id: queued.docId,
      status: queued.status,
      job_id: queued.jobId,
    };
  }

  @Get("documents/:id/file")
  @RequirePermission(PermissionKey.DDT_READ)
  public async getDocumentFile(
    @Param("id") documentIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const workspaceId = requestContext.workspace.workspaceId;
    const documentId = this.getDocumentId(documentIdRaw);
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
  }

  @Delete("documents/:id")
  @HttpCode(200)
  @RequirePermission(PermissionKey.DDT_PROCESS)
  public async deleteDocument(
    @Param("id") documentIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteDdtDocumentSchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const workspaceId = requestContext.workspace.workspaceId;
    const documentId = this.getDocumentId(documentIdRaw);
    const deleted = await this.service.deleteDocument(workspaceId, documentId);
    return {
      deleted,
      doc_id: documentId,
    };
  }

  private getDocumentId(documentId: string): string {
    if (!documentId || !documentId.trim()) {
      throw new AppError("ID documento non valido.", "DDT_DOCUMENT_ID_INVALID", 400);
    }

    return documentId.trim();
  }

  private isPdfFile(fileName: string, mimeType: string, bytes: Buffer): boolean {
    const hasPdfNameOrMime = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
    return hasPdfNameOrMime && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  }
}
