import { randomUUID } from "node:crypto";

import { FileKind } from "../../document-archive/domain/FileKind.js";
import { PutProjectFileCommand } from "../../document-archive/dto/PutProjectFileCommand.js";
import { DocumentArchiveService } from "../../document-archive/services/DocumentArchiveService.js";

type LegacyOrchestratorStatus = "queued" | "running" | "completed" | "failed";

interface LegacyOrchestratorJobState {
  id: string;
  status: LegacyOrchestratorStatus;
  progress: number;
  message: string;
  step: string;
  error: string | null;
  workspaceId: string;
  projectId: string;
  versionLabel: string;
  requestedByUserId: string;
  clientName: string | null;
  createdAt: Date;
  updatedAt: Date;
  result: {
    project_uuid: string;
    output_docx_path: string | null;
    output_docx_storage_path: string | null;
    output_docx_size_bytes: number | null;
    email_recipient: string | null;
    final_message: string | null;
  } | null;
}

export class LegacyQuotationOrchestratorService {
  private readonly documentArchiveService: DocumentArchiveService;
  private readonly jobs: Map<string, LegacyOrchestratorJobState>;

  public constructor(documentArchiveService: DocumentArchiveService) {
    this.documentArchiveService = documentArchiveService;
    this.jobs = new Map();
  }

  public async queueJob(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    requestedByUserId: string;
    clientName?: string | null;
  }): Promise<string> {
    const jobId = randomUUID();
    const now = new Date();
    this.jobs.set(jobId, {
      id: jobId,
      status: "queued",
      progress: 5,
      message: "Job in coda.",
      step: "queued",
      error: null,
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      versionLabel: params.versionLabel,
      requestedByUserId: params.requestedByUserId,
      clientName: params.clientName ?? null,
      createdAt: now,
      updatedAt: now,
      result: null,
    });

    setTimeout(() => {
      void this.runJob(jobId);
    }, 100);

    return jobId;
  }

  public getJob(jobId: string): {
    job_id: string;
    status: LegacyOrchestratorStatus;
    progress: number;
    message: string;
    step: string;
    error: string | null;
    request: {
      project_uuid: string;
      client_name: string | null;
      metadata: {
        source: string;
        version_label: string;
      };
    };
    result: LegacyOrchestratorJobState["result"];
  } | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      job_id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      step: job.step,
      error: job.error,
      request: {
        project_uuid: job.projectId,
        client_name: job.clientName,
        metadata: {
          source: "birgus_internal_orchestrator",
          version_label: job.versionLabel,
        },
      },
      result: job.result,
    };
  }

  private async runJob(jobId: string): Promise<void> {
    const queued = this.jobs.get(jobId);
    if (!queued) {
      return;
    }

    this.patchJob(jobId, {
      status: "running",
      progress: 35,
      message: "Analisi OCR/AI in esecuzione.",
      step: "analyzing",
      error: null,
    });

    await this.sleep(900);

    const current = this.jobs.get(jobId);
    if (!current) {
      return;
    }

    try {
      const docxBytes = this.buildDocxPlaceholder(current);
      const saved = await this.documentArchiveService.putProjectVersionFile(
        new PutProjectFileCommand({
          workspaceId: current.workspaceId,
          projectId: current.projectId,
          versionLabel: current.versionLabel,
          fileKind: FileKind.QUOTATION_DOCX,
          fileName: "preventivo.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bytes: docxBytes,
          uploadedByUserId: current.requestedByUserId,
        }),
      );

      this.patchJob(jobId, {
        status: "completed",
        progress: 100,
        message: "Elaborazione completata.",
        step: "completed",
        error: null,
        result: {
          project_uuid: current.projectId,
          output_docx_path: saved.storagePath,
          output_docx_storage_path: saved.storagePath,
          output_docx_size_bytes: saved.sizeBytes,
          email_recipient: null,
          final_message: "Preventivo DOCX generato con successo.",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore durante l'elaborazione.";
      this.patchJob(jobId, {
        status: "failed",
        progress: 100,
        message: "Elaborazione fallita.",
        step: "failed",
        error: message,
      });
    }
  }

  private patchJob(jobId: string, patch: Partial<LegacyOrchestratorJobState>): void {
    const current = this.jobs.get(jobId);
    if (!current) {
      return;
    }

    this.jobs.set(jobId, {
      ...current,
      ...patch,
      updatedAt: new Date(),
    });
  }

  private buildDocxPlaceholder(job: LegacyOrchestratorJobState): Buffer {
    const lines = [
      "Preventivo generato (placeholder)",
      `Progetto: ${job.projectId}`,
      `Versione: ${job.versionLabel}`,
      `Cliente: ${job.clientName ?? "N/D"}`,
      `Generato il: ${new Date().toISOString()}`,
    ];

    return Buffer.from(lines.join("\n"), "utf8");
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
