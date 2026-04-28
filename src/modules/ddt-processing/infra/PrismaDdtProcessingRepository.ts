import { Prisma } from "@prisma/client";

import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { DdtDocumentEntity } from "../domain/DdtDocumentEntity.js";
import { DdtAnalysisInput, DdtProcessingRepository } from "../repositories/DdtProcessingRepository.js";

export class PrismaDdtProcessingRepository implements DdtProcessingRepository {
  public async upsertDdtDocument(params: {
    workspaceId: string;
    documentId: string;
    requestedByUserId: string | null;
  }): Promise<DdtDocumentEntity> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.ddtDocument.upsert({
      where: {
        document_id: params.documentId,
      },
      update: {
        workspace_id: params.workspaceId,
        requested_by_user_id: params.requestedByUserId,
        status: "QUEUED",
        last_error: null,
      },
      create: {
        workspace_id: params.workspaceId,
        document_id: params.documentId,
        requested_by_user_id: params.requestedByUserId,
        status: "QUEUED",
      },
      select: {
        id: true,
        workspace_id: true,
        document_id: true,
        status: true,
        original_filename: true,
      },
    });

    return new DdtDocumentEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      documentId: row.document_id,
      status: row.status,
      originalFileName: row.original_filename,
    });
  }

  public async createJob(workspaceId: string, ddtDocumentId: string): Promise<string> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.ddtProcessingJob.create({
      data: {
        workspace_id: workspaceId,
        ddt_document_id: ddtDocumentId,
        status: "QUEUED",
      },
      select: {
        id: true,
      },
    });

    return row.id;
  }

  public async updateJobStatus(jobId: string, status: "RUNNING" | "COMPLETED" | "FAILED", errorMessage?: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.ddtProcessingJob.update({
      where: {
        id: jobId,
      },
      data: {
        status,
        started_at: status === "RUNNING" ? new Date() : undefined,
        completed_at: status === "COMPLETED" || status === "FAILED" ? new Date() : undefined,
        error_message: status === "FAILED" ? (errorMessage ?? "Unknown DDT processing failure") : null,
      },
    });
  }

  public async updateDocumentStatus(
    ddtDocumentId: string,
    status: "QUEUED" | "OCR_PROCESSING" | "AI_PROCESSING" | "READY" | "ERROR",
    lastError?: string | null,
  ): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.ddtDocument.update({
      where: {
        id: ddtDocumentId,
      },
      data: {
        status,
        last_error: lastError ?? null,
      },
    });
  }

  public async appendEvent(
    jobId: string,
    ddtDocumentId: string,
    eventType: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.ddtProcessingEvent.create({
      data: {
        job_id: jobId,
        ddt_document_id: ddtDocumentId,
        event_type: eventType,
        payload: this.toInputJson(payload),
      },
    });
  }

  public async saveAnalysis(ddtDocumentId: string, analysis: DdtAnalysisInput): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.$transaction(async (tx) => {
      const result = await tx.ddtAnalysisResult.upsert({
        where: {
          ddt_document_id: ddtDocumentId,
        },
        update: {
          movement_type: analysis.movementType,
          movement_scope: analysis.movementScope,
          main_warehouse_action: analysis.mainWarehouseAction,
          bolla_number: analysis.bollaNumber,
          commessa_reference: analysis.commessaReference,
          transfer_note: analysis.transferNote,
          article_count: analysis.articleCount,
          warehouse_delta: analysis.warehouseDelta,
          summary: analysis.summary,
          raw_response: this.toInputJson(analysis.rawResponse),
        },
        create: {
          ddt_document_id: ddtDocumentId,
          movement_type: analysis.movementType,
          movement_scope: analysis.movementScope,
          main_warehouse_action: analysis.mainWarehouseAction,
          bolla_number: analysis.bollaNumber,
          commessa_reference: analysis.commessaReference,
          transfer_note: analysis.transferNote,
          article_count: analysis.articleCount,
          warehouse_delta: analysis.warehouseDelta,
          summary: analysis.summary,
          raw_response: this.toInputJson(analysis.rawResponse),
        },
        select: {
          id: true,
        },
      });

      await tx.ddtArticleItem.deleteMany({
        where: {
          analysis_result_id: result.id,
        },
      });

      if (analysis.articleItems.length > 0) {
        await tx.ddtArticleItem.createMany({
          data: analysis.articleItems.map((item) => ({
            analysis_result_id: result.id,
            article_type: item.articleType,
            quantity: item.quantity,
            unit: item.unit,
          })),
        });
      }
    });
  }

  private toInputJson(value: Record<string, unknown> | undefined | null): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    return value as Prisma.InputJsonValue;
  }
}
