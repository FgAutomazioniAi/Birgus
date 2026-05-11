import { Prisma } from "@prisma/client";

import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { QuotationJobStateRecord, QuotationOrchestratorRepository } from "../repositories/QuotationOrchestratorRepository.js";

export class PrismaQuotationOrchestratorRepository implements QuotationOrchestratorRepository {
  public async createJob(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    requestedByUserId: string;
    clientName: string | null;
    status: string;
    progress: number;
    message: string;
    step: string;
  }): Promise<QuotationJobStateRecord> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.quotationOrchestratorJob.create({
      data: {
        workspace_id: params.workspaceId,
        project_id: params.projectId,
        version_label: params.versionLabel,
        requested_by_user_id: params.requestedByUserId,
        client_name: params.clientName,
        status: params.status as never,
        progress: params.progress,
        message: params.message,
        step: params.step,
      },
    });

    return this.toRecord(row);
  }

  public async findJobById(jobId: string): Promise<QuotationJobStateRecord | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.quotationOrchestratorJob.findFirst({
      where: {
        id: jobId,
      },
    });

    return row ? this.toRecord(row) : null;
  }

  public async updateJob(jobId: string, patch: {
    status?: string;
    progress?: number;
    message?: string | null;
    step?: string | null;
    error?: string | null;
    outputDocxPath?: string | null;
    outputDocxStoragePath?: string | null;
    outputDocxSizeBytes?: number | null;
    emailRecipient?: string | null;
    mailDeliveryStatus?: string;
    mailSentAt?: Date | null;
    mailError?: string | null;
    finalMessage?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const data: Prisma.QuotationOrchestratorJobUpdateInput = {
      status: patch.status as never,
      progress: patch.progress,
      message: patch.message,
      step: patch.step,
      error: patch.error,
      output_docx_path: patch.outputDocxPath,
      output_docx_storage_path: patch.outputDocxStoragePath,
      output_docx_size_bytes: patch.outputDocxSizeBytes === undefined || patch.outputDocxSizeBytes === null
        ? patch.outputDocxSizeBytes
        : BigInt(patch.outputDocxSizeBytes),
      email_recipient: patch.emailRecipient,
      mail_delivery_status: patch.mailDeliveryStatus as never,
      mail_sent_at: patch.mailSentAt,
      mail_error: patch.mailError,
      final_message: patch.finalMessage,
      started_at: patch.startedAt,
      completed_at: patch.completedAt,
    };

    await prisma.quotationOrchestratorJob.update({
      where: {
        id: jobId,
      },
      data,
    });
  }

  public async listRecoverableJobs(): Promise<QuotationJobStateRecord[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.quotationOrchestratorJob.findMany({
      where: {
        status: {
          in: ["QUEUED", "RUNNING"],
        },
      },
      orderBy: {
        queued_at: "asc",
      },
    });

    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: Record<string, unknown>): QuotationJobStateRecord {
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      projectId: String(row.project_id),
      versionLabel: String(row.version_label),
      requestedByUserId: typeof row.requested_by_user_id === "string" ? row.requested_by_user_id : null,
      clientName: typeof row.client_name === "string" ? row.client_name : null,
      status: String(row.status),
      progress: Number(row.progress ?? 0),
      message: typeof row.message === "string" ? row.message : null,
      step: typeof row.step === "string" ? row.step : null,
      error: typeof row.error === "string" ? row.error : null,
      outputDocxPath: typeof row.output_docx_path === "string" ? row.output_docx_path : null,
      outputDocxStoragePath: typeof row.output_docx_storage_path === "string" ? row.output_docx_storage_path : null,
      outputDocxSizeBytes: typeof row.output_docx_size_bytes === "bigint"
        ? Number(row.output_docx_size_bytes)
        : typeof row.output_docx_size_bytes === "number"
          ? row.output_docx_size_bytes
          : null,
      emailRecipient: typeof row.email_recipient === "string" ? row.email_recipient : null,
      mailDeliveryStatus: String(row.mail_delivery_status ?? "PENDING"),
      mailSentAt: row.mail_sent_at instanceof Date ? row.mail_sent_at : row.mail_sent_at ? new Date(String(row.mail_sent_at)) : null,
      mailError: typeof row.mail_error === "string" ? row.mail_error : null,
      finalMessage: typeof row.final_message === "string" ? row.final_message : null,
      queuedAt: row.queued_at instanceof Date ? row.queued_at : new Date(String(row.queued_at)),
      startedAt: row.started_at instanceof Date ? row.started_at : row.started_at ? new Date(String(row.started_at)) : null,
      completedAt: row.completed_at instanceof Date ? row.completed_at : row.completed_at ? new Date(String(row.completed_at)) : null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
    };
  }
}
