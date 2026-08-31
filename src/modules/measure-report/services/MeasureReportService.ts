import { Buffer } from "node:buffer";
import { DocumentScope } from "@prisma/client";

import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { GaragePath } from "../../../storage/GaragePath.js";
import { ProjectBinaryStorage } from "../../../storage/ProjectBinaryStorage.js";
import { NotificationService } from "../../notifications/services/NotificationService.js";
import { WorkflowService } from "../../workflows/services/WorkflowService.js";
import {
  inferMeasureReportDocumentTypeFromFilename,
  MEASURE_REPORT_DOCUMENT_TYPE_LABELS,
  MEASURE_REPORT_DOCUMENT_TYPES,
  normalizeMeasureReportDocumentType,
  resolveMeasureReportEffectiveDocumentType,
} from "./MeasureReportDocumentTypes.js";

interface MeasureReportRowDto {
  row_index: number;
  row_text: string;
  note: string | null;
  page_hint: string | null;
}

export interface MeasureReportDocumentDto {
  id: string;
  original_filename: string;
  status: string;
  document_type_requested: string;
  document_type_effective: string | null;
  rows_count: number;
  out_of_tolerance_rows: MeasureReportRowDto[];
  analysis_summary: string | null;
  prompt_agent_key: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface MeasureReportDocumentRow {
  id: string;
  status: string;
  original_filename: string | null;
  document_type_requested: string;
  document_type_effective: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  document: {
    id: string;
    filename: string | null;
    storage_path: string;
    deleted_at: Date | null;
  };
  analysis_result: {
    rows_count: number;
    summary: string | null;
    prompt_agent_key: string | null;
    rows: Array<{
      row_index: number;
      row_text: string;
      note: string | null;
      page_hint: string | null;
    }>;
  } | null;
}

export class MeasureReportService {
  private static readonly WORKFLOW_KEY = "measure_report_pipeline";
  private readonly objectStorage: ProjectBinaryStorage;
  private readonly workflowService: WorkflowService;
  private readonly notificationService: NotificationService | null;

  public constructor(
    objectStorage: ProjectBinaryStorage,
    workflowService: WorkflowService,
    notificationService?: NotificationService | null,
  ) {
    this.objectStorage = objectStorage;
    this.workflowService = workflowService;
    this.notificationService = notificationService ?? null;
  }

  public getConfig(): {
    single_document_mode: boolean;
    analysis_mode: string;
    document_types: Array<{ value: string; label: string }>;
  } {
    return {
      single_document_mode: true,
      analysis_mode: process.env.MEASURE_REPORT_ANALYSIS_MODE ?? "auto",
      document_types: MEASURE_REPORT_DOCUMENT_TYPES.map((value) => ({
        value,
        label: MEASURE_REPORT_DOCUMENT_TYPE_LABELS[value],
      })),
    };
  }

  public async listDocuments(workspaceId: string): Promise<MeasureReportDocumentDto[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.measureReportDocument.findMany({
      where: {
        workspace_id: workspaceId,
        document: {
          is: {
            deleted_at: null,
          },
        },
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            storage_path: true,
            deleted_at: true,
          },
        },
        analysis_result: {
          include: {
            rows: {
              orderBy: {
                row_index: "asc",
              },
            },
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return rows.map((row) => this.toDocumentDto(row as unknown as MeasureReportDocumentRow));
  }

  public async getDocument(workspaceId: string, measureReportDocumentId: string): Promise<MeasureReportDocumentDto | null> {
    const row = await this.findDocument(workspaceId, measureReportDocumentId);
    return row ? this.toDocumentDto(row) : null;
  }

  public async uploadDocument(params: {
    workspaceId: string;
    requestedByUserId: string | null;
    fileName: string;
    mimeType: string;
    bytes: Buffer;
  }): Promise<MeasureReportDocumentDto> {
    if (params.bytes.length === 0) {
      throw new AppError("File vuoto.", "MEASURE_REPORT_FILE_EMPTY", 400);
    }

    const prisma = PrismaClientManager.getClient();
    const fileName = this.resolveFileName(params.fileName);
    const objectKey = this.buildObjectKey(params.workspaceId, fileName, params.bytes);

    const storedObject = await this.objectStorage.putObject({
      bucket: this.objectStorage.defaultBucket(),
      objectKey,
      bytes: params.bytes,
      contentType: params.mimeType || "application/pdf",
      metadata: {
        workspaceid: params.workspaceId,
        scope: "measure-report",
      },
    });

    const storagePath = GaragePath.toStoragePath(storedObject.bucket, storedObject.objectKey);
    const rootNode = await this.ensureMeasureReportNode(params.workspaceId);

    const [pdfType, uploadedStatus, measureReportModule] = await Promise.all([
      prisma.fileType.upsert({
        where: { key: "pdf" },
        update: { mime_type: "application/pdf" },
        create: { key: "pdf", mime_type: "application/pdf" },
      }),
      prisma.fileStatus.upsert({
        where: { key: "uploaded" },
        update: {},
        create: { key: "uploaded" },
      }),
      prisma.module.findFirst({
        where: {
          key: ModuleKey.MEASURE_REPORT,
          is_active: true,
        },
        select: {
          id: true,
        },
      }),
    ]);

    const createdDocument = await prisma.document.create({
      data: {
        workspace_id: params.workspaceId,
        node_id: rootNode.id,
        file_type_id: pdfType.id,
        file_status_id: uploadedStatus.id,
        module_id: measureReportModule?.id ?? null,
        scope: DocumentScope.MEASURE_REPORT,
        domain_entity_type: "MeasureReportDocument",
        filename: fileName,
        size_bytes: BigInt(params.bytes.length),
        storage_path: storagePath,
        uploaded_by_user_id: params.requestedByUserId,
      },
      select: {
        id: true,
      },
    });

    const requestedType = inferMeasureReportDocumentTypeFromFilename(fileName);
    const created = await prisma.measureReportDocument.create({
      data: {
        workspace_id: params.workspaceId,
        document_id: createdDocument.id,
        status: "UPLOADED",
        original_filename: fileName,
        document_type_requested: requestedType,
        requested_by_user_id: params.requestedByUserId,
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            storage_path: true,
            deleted_at: true,
          },
        },
        analysis_result: {
          include: {
            rows: true,
          },
        },
      },
    });

    await prisma.document.update({
      where: {
        id: createdDocument.id,
      },
      data: {
        domain_entity_id: created.id,
      },
    });

    await this.notify(params.workspaceId, "Measure Report", `Caricato "${fileName}".`);
    return this.toDocumentDto(created as unknown as MeasureReportDocumentRow);
  }

  public async queueAnalyze(params: {
    workspaceId: string;
    requestedByUserId: string | null;
    measureReportDocumentId: string;
    requestedDocumentType?: string | null;
  }): Promise<{ queued: boolean; docId: string; status: string; jobId: string }> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.measureReportDocument.findFirst({
      where: {
        workspace_id: params.workspaceId,
        id: params.measureReportDocumentId,
        document: {
          is: {
            deleted_at: null,
          },
        },
      },
      select: {
        id: true,
        document_id: true,
        document_type_requested: true,
        original_filename: true,
        document: {
          select: {
            filename: true,
          },
        },
      },
    });

    if (!row) {
      throw new AppError("Documento non trovato.", "MEASURE_REPORT_DOCUMENT_NOT_FOUND", 404);
    }

    const requestedType = normalizeMeasureReportDocumentType(
      params.requestedDocumentType ?? row.document_type_requested,
    );
    const displayName = this.resolveDocumentDisplayName(row.original_filename, row.document?.filename ?? null);
    const effectiveType = resolveMeasureReportEffectiveDocumentType(requestedType, displayName);

    await prisma.measureReportDocument.update({
      where: {
        id: row.id,
      },
      data: {
        status: "QUEUED",
        document_type_requested: requestedType,
        document_type_effective: effectiveType,
        last_error: null,
      },
    });

    const workflow = await this.workflowService.findWorkflowByKey(
      params.workspaceId,
      ModuleKey.MEASURE_REPORT,
      MeasureReportService.WORKFLOW_KEY,
    );

    if (!workflow) {
      throw new AppError("Workflow Measure Report non configurato.", "MEASURE_REPORT_WORKFLOW_NOT_FOUND", 503);
    }

    const run = await this.workflowService.createWorkflowRun({
      workspaceId: params.workspaceId,
      workflowId: workflow.id,
      requestedByUserId: params.requestedByUserId,
      triggerSource: "measure_report",
      contextEntityType: "MeasureReportDocument",
      contextEntityId: row.id,
      projectId: null,
      projectVersionId: null,
      clientId: null,
      documentId: row.document_id,
      ddtDocumentId: null,
      measureReportDocumentId: row.id,
      inputPayload: {
        measureReportDocumentId: row.id,
        documentId: row.document_id,
        documentType: effectiveType,
      },
    });

    await this.notify(params.workspaceId, "Measure Report", `Analisi avviata su "${displayName}".`);

    return {
      queued: true,
      docId: row.id,
      status: "queued",
      jobId: run.id,
    };
  }

  public async deleteDocument(workspaceId: string, measureReportDocumentId: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.measureReportDocument.findFirst({
      where: {
        workspace_id: workspaceId,
        id: measureReportDocumentId,
      },
      include: {
        document: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!row) {
      return false;
    }

    await prisma.$transaction(async (tx) => {
      await tx.measureReportDocument.delete({
        where: {
          id: row.id,
        },
      });

      await tx.document.update({
        where: {
          id: row.document.id,
        },
        data: {
          deleted_at: new Date(),
        },
      });
    });

    return true;
  }

  public async getDocumentFile(params: {
    workspaceId: string;
    measureReportDocumentId: string;
  }): Promise<{ bytes: Buffer; contentType: string; fileName: string } | null> {
    const row = await this.findDocument(params.workspaceId, params.measureReportDocumentId);
    if (!row) {
      return null;
    }

    const payload = await this.readStoragePayload(row.document.storage_path);
    if (!payload) {
      return null;
    }

    return {
      bytes: payload.bytes,
      contentType: payload.contentType ?? "application/pdf",
      fileName: row.original_filename ?? row.document.filename ?? "document.pdf",
    };
  }

  private async findDocument(workspaceId: string, measureReportDocumentId: string): Promise<MeasureReportDocumentRow | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.measureReportDocument.findFirst({
      where: {
        workspace_id: workspaceId,
        id: measureReportDocumentId,
        document: {
          is: {
            deleted_at: null,
          },
        },
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            storage_path: true,
            deleted_at: true,
          },
        },
        analysis_result: {
          include: {
            rows: {
              orderBy: {
                row_index: "asc",
              },
            },
          },
        },
      },
    });

    return row ? (row as unknown as MeasureReportDocumentRow) : null;
  }

  private toDocumentDto(row: MeasureReportDocumentRow): MeasureReportDocumentDto {
    return {
      id: row.id,
      original_filename: this.resolveDocumentDisplayName(row.original_filename, row.document.filename),
      status: row.status.toLowerCase(),
      document_type_requested: normalizeMeasureReportDocumentType(row.document_type_requested),
      document_type_effective: row.document_type_effective ? normalizeMeasureReportDocumentType(row.document_type_effective) : null,
      rows_count: row.analysis_result?.rows_count ?? 0,
      out_of_tolerance_rows: (row.analysis_result?.rows ?? []).map((item) => ({
        row_index: item.row_index,
        row_text: item.row_text,
        note: item.note,
        page_hint: item.page_hint,
      })),
      analysis_summary: row.analysis_result?.summary ?? null,
      prompt_agent_key: row.analysis_result?.prompt_agent_key ?? null,
      last_error: row.last_error,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  private resolveDocumentDisplayName(originalFileName: string | null, fallbackFileName: string | null): string {
    return originalFileName?.trim() || fallbackFileName?.trim() || "document.pdf";
  }

  private resolveFileName(fileName: string): string {
    const trimmed = fileName.trim();
    return trimmed.length > 0 ? trimmed : "measure-report.pdf";
  }

  private buildObjectKey(workspaceId: string, fileName: string, bytes: Buffer): string {
    const safeName = fileName.replace(/[^\w.\-]+/g, "_");
    const stamp = Date.now().toString(36);
    return `measure-report/${workspaceId}/${stamp}-${bytes.length}-${safeName}`;
  }

  private async ensureMeasureReportNode(workspaceId: string): Promise<{ id: string }> {
    const root = await this.ensureNode(workspaceId, null, "measure-report", "/measure-report", 0);
    return this.ensureNode(
      workspaceId,
      root.id,
      "documents",
      "/measure-report/documents",
      1,
    );
  }

  private async ensureNode(
    workspaceId: string,
    parentId: string | null,
    name: string,
    pathCache: string,
    depth: number,
  ): Promise<{ id: string }> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.node.findFirst({
      where: {
        workspace_id: workspaceId,
        path_cache: pathCache,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.node.create({
      data: {
        workspace_id: workspaceId,
        parent_id: parentId,
        name,
        path_cache: pathCache,
        depth,
      },
      select: {
        id: true,
      },
    });
  }

  private async readStoragePayload(storagePath: string): Promise<{ bytes: Buffer; contentType: string | null } | null> {
    if (!storagePath.startsWith("garage://")) {
      return null;
    }

    try {
      const parsed = GaragePath.parse(storagePath);
      const payload = await this.objectStorage.getObject(parsed.bucket, parsed.objectKey);
      return {
        bytes: payload.bytes,
        contentType: payload.contentType ?? null,
      };
    } catch (error) {
      console.error("[MeasureReportService] Unable to read storage payload", { storagePath, error });
      return null;
    }
  }

  private async notify(workspaceId: string, title: string, message: string): Promise<void> {
    if (!this.notificationService) {
      return;
    }

    try {
      await this.notificationService.createInfo({
        workspaceId,
        userId: null,
        moduleKey: ModuleKey.MEASURE_REPORT,
        title,
        message,
      });
    } catch (error) {
      console.error("[MeasureReportService] Unable to create notification", { workspaceId, title, message, error });
    }
  }
}
