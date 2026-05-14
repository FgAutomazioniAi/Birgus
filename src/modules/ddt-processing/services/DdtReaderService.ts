import { randomUUID } from "node:crypto";

import { DocumentScope } from "@prisma/client";

import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { GaragePath } from "../../../storage/GaragePath.js";
import { ProjectBinaryStorage } from "../../../storage/ProjectBinaryStorage.js";
import { NotificationService } from "../../notifications/services/NotificationService.js";
import { WorkflowService } from "../../workflows/services/WorkflowService.js";

interface DdtArticleItem {
  article_type: string;
  quantity: number;
  unit: string;
}

export interface DdtReaderDocumentDto {
  id: string;
  original_filename: string;
  status: string;
  movement_type: string | null;
  movement_scope: string | null;
  main_warehouse_action: string | null;
  bolla_number: string | null;
  commessa_reference: string | null;
  transfer_note: string | null;
  article_count: number | null;
  warehouse_delta: number | null;
  article_items: DdtArticleItem[];
  analysis_summary: string | null;
  ocr_duration_ms: number | null;
  inference_duration_ms: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface DdtDocumentRow {
  id: string;
  status: string;
  original_filename: string | null;
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
    movement_type: string | null;
    movement_scope: string | null;
    main_warehouse_action: string | null;
    bolla_number: string | null;
    commessa_reference: string | null;
    transfer_note: string | null;
    article_count: number | null;
    warehouse_delta: number | null;
    summary: string | null;
    raw_response?: unknown;
    article_items: Array<{
      article_type: string;
      quantity: unknown;
      unit: string;
    }>;
  } | null;
}

export class DdtReaderService {
  private static readonly DDT_WORKFLOW_KEY = "ddt_reader_pipeline";
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

  public getConfig(): { single_document_mode: boolean; lm_model: string; lm_base_url: string } {
    return {
      single_document_mode: true,
      lm_model: process.env.DDT_READER_LM_MODEL ?? "",
      lm_base_url: process.env.DDT_READER_LM_BASE_URL ?? "",
    };
  }

  public async listDocuments(workspaceId: string): Promise<DdtReaderDocumentDto[]> {
    const prisma = PrismaClientManager.getClient();

    const rows = await prisma.ddtDocument.findMany({
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
            article_items: {
              orderBy: {
                id: "asc",
              },
            },
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return rows.map((row) => this.toDocumentDto(row as unknown as DdtDocumentRow));
  }

  public async getDocument(workspaceId: string, ddtDocumentId: string): Promise<DdtReaderDocumentDto | null> {
    const row = await this.findDdtDocument(workspaceId, ddtDocumentId);
    return row ? this.toDocumentDto(row) : null;
  }

  public async uploadDocument(params: {
    workspaceId: string;
    requestedByUserId: string | null;
    fileName: string;
    mimeType: string;
    bytes: Buffer;
  }): Promise<DdtReaderDocumentDto> {
    if (params.bytes.length === 0) {
      throw new AppError("File vuoto.", "DDT_FILE_EMPTY", 400);
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
        scope: "ddt-reader",
      },
    });

    const storagePath = GaragePath.toStoragePath(storedObject.bucket, storedObject.objectKey);
    const ddtNode = await this.ensureDdtNode(params.workspaceId);

    const [pdfType, uploadedStatus, ddtModule] = await Promise.all([
      prisma.fileType.upsert({
        where: {
          key: "pdf",
        },
        update: {
          mime_type: "application/pdf",
        },
        create: {
          key: "pdf",
          mime_type: "application/pdf",
        },
      }),
      prisma.fileStatus.upsert({
        where: {
          key: "uploaded",
        },
        update: {},
        create: {
          key: "uploaded",
        },
      }),
      prisma.module.findFirst({
        where: {
          key: ModuleKey.DDT_PROCESSING,
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
        node_id: ddtNode.id,
        file_type_id: pdfType.id,
        file_status_id: uploadedStatus.id,
        module_id: ddtModule?.id ?? null,
        scope: DocumentScope.DDT,
        domain_entity_type: "DdtDocument",
        filename: fileName,
        size_bytes: BigInt(params.bytes.length),
        storage_path: storagePath,
        uploaded_by_user_id: params.requestedByUserId,
      },
      select: {
        id: true,
      },
    });

    const created = await prisma.ddtDocument.create({
      data: {
        workspace_id: params.workspaceId,
        document_id: createdDocument.id,
        status: "UPLOADED",
        original_filename: fileName,
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
            article_items: true,
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

    await this.notify(params.workspaceId, "DDT", `Caricato "${fileName}".`);

    return this.toDocumentDto(created as unknown as DdtDocumentRow);
  }

  public async queueAnalyze(params: {
    workspaceId: string;
    requestedByUserId: string | null;
    ddtDocumentId: string;
  }): Promise<{ queued: boolean; docId: string; status: string; jobId: string }> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.ddtDocument.findFirst({
      where: {
        workspace_id: params.workspaceId,
        id: params.ddtDocumentId,
        document: {
          is: {
            deleted_at: null,
          },
        },
      },
      select: {
        id: true,
        document_id: true,
        original_filename: true,
        document: {
          select: {
            filename: true,
          },
        },
      },
    });

    if (!row) {
      throw new AppError("Documento non trovato.", "DDT_DOCUMENT_NOT_FOUND", 404);
    }

    await prisma.ddtDocument.update({
      where: {
        id: row.id,
      },
      data: {
        status: "QUEUED",
        last_error: null,
      },
    });

    const workflow = await this.workflowService.findWorkflowByKey(
      params.workspaceId,
      ModuleKey.DDT_PROCESSING,
      DdtReaderService.DDT_WORKFLOW_KEY,
    );

    if (!workflow) {
      throw new AppError("Workflow DDT non configurato.", "DDT_WORKFLOW_NOT_FOUND", 503);
    }

    const run = await this.workflowService.createWorkflowRun({
      workspaceId: params.workspaceId,
      workflowId: workflow.id,
      requestedByUserId: params.requestedByUserId,
      triggerSource: "ddt_reader",
      contextEntityType: "DdtDocument",
      contextEntityId: row.id,
      projectId: null,
      projectVersionId: null,
      clientId: null,
      shipmentId: null,
      documentId: row.document_id,
      ddtDocumentId: row.id,
      inputPayload: {
        ddtDocumentId: row.id,
        documentId: row.document_id,
      },
    });

    const displayName = this.resolveDocumentDisplayName(row.original_filename, row.document?.filename ?? null);
    await this.notify(params.workspaceId, "DDT", `Analisi avviata su "${displayName}".`);

    return {
      queued: true,
      docId: row.id,
      status: "queued",
      jobId: run.id,
    };
  }

  public async deleteDocument(workspaceId: string, ddtDocumentId: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.ddtDocument.findFirst({
      where: {
        workspace_id: workspaceId,
        id: ddtDocumentId,
      },
      include: {
        document: {
          select: {
            id: true,
            storage_path: true,
          },
        },
      },
    });

    if (!row) {
      return false;
    }

    await prisma.$transaction(async (tx) => {
      await tx.ddtDocument.delete({
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
    ddtDocumentId: string;
  }): Promise<{ bytes: Buffer; contentType: string; fileName: string } | null> {
    const row = await this.findDdtDocument(params.workspaceId, params.ddtDocumentId);
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

  private async findDdtDocument(workspaceId: string, ddtDocumentId: string): Promise<DdtDocumentRow | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.ddtDocument.findFirst({
      where: {
        workspace_id: workspaceId,
        id: ddtDocumentId,
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
            article_items: {
              orderBy: {
                id: "asc",
              },
            },
          },
        },
      },
    });

    return row ? (row as unknown as DdtDocumentRow) : null;
  }

  private async ensureDdtNode(workspaceId: string): Promise<{ id: string; depth: number }> {
    const root = await this.ensureNode(workspaceId, null, "ddt-reader", "/ddt-reader", 0);

    return this.ensureNode(
      workspaceId,
      root.id,
      "documents",
      "/ddt-reader/documents",
      root.depth + 1,
    );
  }

  private async ensureNode(
    workspaceId: string,
    parentId: string | null,
    name: string,
    pathCache: string,
    depth: number,
  ): Promise<{ id: string; depth: number }> {
    const prisma = PrismaClientManager.getClient();

    const existing = await prisma.node.findFirst({
      where: {
        workspace_id: workspaceId,
        path_cache: pathCache,
        deleted_at: null,
      },
      select: {
        id: true,
        depth: true,
      },
    });

    if (existing) {
      return {
        id: existing.id,
        depth: existing.depth,
      };
    }

    const created = await prisma.node.create({
      data: {
        workspace_id: workspaceId,
        parent_id: parentId,
        name,
        path_cache: pathCache,
        depth,
      },
      select: {
        id: true,
        depth: true,
      },
    });

    return {
      id: created.id,
      depth: created.depth,
    };
  }

  private toDocumentDto(row: DdtDocumentRow): DdtReaderDocumentDto {
    const analysis = row.analysis_result;
    const timings = this.extractTimingInfo(analysis?.raw_response);

    return {
      id: row.id,
      original_filename: row.original_filename ?? row.document.filename ?? "document.pdf",
      status: this.toApiStatus(row.status),
      movement_type: analysis?.movement_type ?? null,
      movement_scope: analysis?.movement_scope ?? null,
      main_warehouse_action: analysis?.main_warehouse_action ?? null,
      bolla_number: analysis?.bolla_number ?? null,
      commessa_reference: analysis?.commessa_reference ?? null,
      transfer_note: analysis?.transfer_note ?? null,
      article_count: analysis?.article_count ?? null,
      warehouse_delta: analysis?.warehouse_delta ?? null,
      article_items: (analysis?.article_items ?? []).map((item) => ({
        article_type: item.article_type,
        quantity: this.toNumber(item.quantity),
        unit: item.unit,
      })),
      analysis_summary: analysis?.summary ?? null,
      ocr_duration_ms: timings.ocrDurationMs,
      inference_duration_ms: timings.inferenceDurationMs,
      last_error: row.last_error ?? null,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  private extractTimingInfo(rawResponse: unknown): { ocrDurationMs: number | null; inferenceDurationMs: number | null } {
    const directTimings = this.readNestedRecord(rawResponse, ["timings"]);
    const nestedTimings = this.readNestedRecord(rawResponse, ["response", "timings"]);
    const timings = directTimings ?? nestedTimings;

    return {
      ocrDurationMs: this.readFiniteNumber(timings?.ocr_ms),
      inferenceDurationMs: this.readFiniteNumber(timings?.inference_ms),
    };
  }

  private toApiStatus(status: string): string {
    return status.toLowerCase();
  }

  private toNumber(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "bigint") {
      return Number(value);
    }

    if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: unknown }).toNumber === "function") {
      return (value as { toNumber: () => number }).toNumber();
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private readNestedRecord(source: unknown, path: string[]): Record<string, unknown> | null {
    let current: unknown = source;

    for (const key of path) {
      if (!current || typeof current !== "object" || Array.isArray(current) || !(key in current)) {
        return null;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }

    return current as Record<string, unknown>;
  }

  private readFiniteNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private resolveFileName(fileName: string): string {
    const trimmed = fileName.trim();
    return trimmed.length > 0 ? trimmed : "document.pdf";
  }

  private resolveDocumentDisplayName(originalFileName: string | null, fallbackFileName: string | null): string {
    const preferred = originalFileName?.trim() || fallbackFileName?.trim() || "";
    return preferred.length > 0 ? preferred : "document.pdf";
  }

  private async notify(workspaceId: string, title: string, message: string): Promise<void> {
    if (!this.notificationService) {
      return;
    }

    try {
      await this.notificationService.createInfo({
        workspaceId,
        userId: null,
        moduleKey: ModuleKey.DDT_PROCESSING,
        title,
        message,
      });
    } catch (error) {
      console.error("[DdtReaderService] Unable to create notification", { workspaceId, title, message, error });
    }
  }

  private buildObjectKey(workspaceId: string, fileName: string, bytes: Buffer): string {
    const fileSha = this.objectStorage.sha256Hex(bytes);
    const safeName = this.sanitizeFileName(fileName);

    return [
      this.sanitizeSegment(this.objectStorage.storagePrefix()),
      "ddt-reader",
      this.sanitizeSegment(workspaceId),
      fileSha,
      `${Date.now()}-${randomUUID()}`,
      safeName,
    ].join("/");
  }

  private sanitizeFileName(fileName: string): string {
    const trimmed = fileName.trim();
    const withFallback = trimmed || "document.pdf";

    return withFallback
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "document.pdf";
  }

  private sanitizeSegment(value: string): string {
    return value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "na";
  }

  private async readStoragePayload(storagePath: string): Promise<{ bytes: Buffer; contentType: string | null } | null> {
    if (!storagePath.startsWith("garage://")) {
      return null;
    }

    const parsed = GaragePath.parse(storagePath);
    const payload = await this.objectStorage.getObject(parsed.bucket, parsed.objectKey);
    return {
      bytes: payload.bytes,
      contentType: payload.contentType,
    };
  }
}
