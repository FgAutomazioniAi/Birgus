import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { MeasureReportService } from "../../modules/measure-report/services/MeasureReportService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";
import { MultipartFormReader } from "../../shared/http/MultipartFormReader.js";

const analyzeMeasureReportSchema = z.object({
  document_type: z.string().min(1).optional().nullable(),
});

const deleteMeasureReportSchema = z.object({
  confirmText: z.string().min(1),
});

@Controller("/api/measure-reports")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.MEASURE_REPORT)
export class NestMeasureReportController {
  public constructor(
    @Inject(MeasureReportService)
    private readonly service: MeasureReportService,
  ) {}

  @Get("config")
  @RequirePermission(PermissionKey.MEASURE_REPORT_READ)
  public getConfig() {
    return this.service.getConfig();
  }

  @Get("documents")
  @RequirePermission(PermissionKey.MEASURE_REPORT_READ)
  public async listDocuments(
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    return this.service.listDocuments(requestContext.workspace.workspaceId);
  }

  @Post("documents")
  @HttpCode(200)
  @RequirePermission(PermissionKey.MEASURE_REPORT_PROCESS)
  public async uploadDocument(
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    const multipart = await MultipartFormReader.read(request);
    const uploaded = multipart.files.find((item) => item.fieldName === "file") ?? multipart.files[0];
    if (!uploaded) {
      throw new AppError("File mancante.", "MEASURE_REPORT_FILE_REQUIRED", 400);
    }
    if (!this.isPdfFile(uploaded.fileName, uploaded.mimeType, uploaded.bytes)) {
      throw new AppError("Sono accettati solo file PDF.", "MEASURE_REPORT_FILE_EXTENSION_INVALID", 400);
    }

    return this.service.uploadDocument({
      workspaceId: requestContext.workspace.workspaceId,
      requestedByUserId: requestContext.workspace.userId,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      bytes: uploaded.bytes,
    });
  }

  @Get("documents/:id")
  @RequirePermission(PermissionKey.MEASURE_REPORT_READ)
  public async getDocument(
    @Param("id") documentIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ) {
    const document = await this.service.getDocument(
      requestContext.workspace.workspaceId,
      this.getDocumentId(documentIdRaw),
    );
    if (!document) {
      throw new AppError("Documento non trovato.", "MEASURE_REPORT_DOCUMENT_NOT_FOUND", 404);
    }

    return document;
  }

  @Post("documents/:id/analyze")
  @HttpCode(200)
  @RequirePermission(PermissionKey.MEASURE_REPORT_PROCESS)
  public async analyzeDocument(
    @Param("id") documentIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = analyzeMeasureReportSchema.parse(bodyRaw ?? {});
    const queued = await this.service.queueAnalyze({
      workspaceId: requestContext.workspace.workspaceId,
      requestedByUserId: requestContext.workspace.userId,
      measureReportDocumentId: this.getDocumentId(documentIdRaw),
      requestedDocumentType: body.document_type,
    });

    return {
      queued: queued.queued,
      doc_id: queued.docId,
      status: queued.status,
      job_id: queued.jobId,
    };
  }

  @Delete("documents/:id")
  @HttpCode(200)
  @RequirePermission(PermissionKey.MEASURE_REPORT_PROCESS)
  public async deleteDocument(
    @Param("id") documentIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteMeasureReportSchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const documentId = this.getDocumentId(documentIdRaw);
    const deleted = await this.service.deleteDocument(
      requestContext.workspace.workspaceId,
      documentId,
    );

    return {
      deleted,
      doc_id: documentId,
    };
  }

  @Get("documents/:id/file")
  @RequirePermission(PermissionKey.MEASURE_REPORT_READ)
  public async getDocumentFile(
    @Param("id") documentIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const file = await this.service.getDocumentFile({
      workspaceId: requestContext.workspace.workspaceId,
      measureReportDocumentId: this.getDocumentId(documentIdRaw),
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

  private getDocumentId(documentId: string): string {
    if (!documentId || !documentId.trim()) {
      throw new AppError("ID documento non valido.", "MEASURE_REPORT_DOCUMENT_ID_INVALID", 400);
    }

    return documentId.trim();
  }

  private isPdfFile(fileName: string, mimeType: string, bytes: Buffer): boolean {
    const hasPdfNameOrMime = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
    return hasPdfNameOrMime && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  }
}
