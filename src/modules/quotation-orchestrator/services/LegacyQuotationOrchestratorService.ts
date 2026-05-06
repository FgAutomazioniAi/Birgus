import { randomUUID } from "node:crypto";

import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { FileKind } from "../../document-archive/domain/FileKind.js";
import { PutProjectFileCommand } from "../../document-archive/dto/PutProjectFileCommand.js";
import { DocumentArchiveService } from "../../document-archive/services/DocumentArchiveService.js";
import { QuotationAnalysisResult } from "../domain/QuotationStructuredData.js";
import { NextOrchestratorQuotationAnalyzer } from "./NextOrchestratorQuotationAnalyzer.js";
import { QuotationDocxBuilder } from "./QuotationDocxBuilder.js";

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
  private readonly quotationAnalyzer: NextOrchestratorQuotationAnalyzer;
  private readonly docxBuilder: QuotationDocxBuilder;
  private readonly jobs: Map<string, LegacyOrchestratorJobState>;

  public constructor(
    documentArchiveService: DocumentArchiveService,
    quotationAnalyzer: NextOrchestratorQuotationAnalyzer,
    docxBuilder: QuotationDocxBuilder,
  ) {
    this.documentArchiveService = documentArchiveService;
    this.quotationAnalyzer = quotationAnalyzer;
    this.docxBuilder = docxBuilder;
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

    try {
      this.patchJob(jobId, {
        status: "running",
        progress: 15,
        message: "Recupero preventivo PDF da archivio.",
        step: "resolve_source",
        error: null,
      });

      const quotationSource = await this.loadQuotationSource({
        workspaceId: queued.workspaceId,
        projectId: queued.projectId,
        versionLabel: queued.versionLabel,
      });

      this.patchJob(jobId, {
        status: "running",
        progress: 45,
        message: "Analisi OCR/AI del preventivo in esecuzione.",
        step: "analyzing",
        error: null,
      });

      const analysis = await this.quotationAnalyzer.analyze({
        workspaceId: queued.workspaceId,
        projectId: queued.projectId,
        storagePath: quotationSource.storagePath,
        fileName: quotationSource.fileName,
      });

      this.patchJob(jobId, {
        status: "running",
        progress: 75,
        message: "Generazione DOCX del preventivo.",
        step: "docx_generation",
        error: null,
      });

      const docxBytes = await this.docxBuilder.build(analysis.structuredData);

      this.patchJob(jobId, {
        status: "running",
        progress: 90,
        message: "Salvataggio documento generato in archivio.",
        step: "storing",
        error: null,
      });

      const saved = await this.documentArchiveService.putProjectVersionFile(
        new PutProjectFileCommand({
          workspaceId: queued.workspaceId,
          projectId: queued.projectId,
          versionLabel: queued.versionLabel,
          fileKind: FileKind.QUOTATION_DOCX,
          fileName: "preventivo.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bytes: docxBytes,
          uploadedByUserId: queued.requestedByUserId,
        }),
      );

      const versionContext = await this.loadVersionContext({
        workspaceId: queued.workspaceId,
        projectId: queued.projectId,
        versionLabel: queued.versionLabel,
      });

      this.patchJob(jobId, {
        status: "completed",
        progress: 100,
        message: "Preventivo DOCX generato con successo.",
        step: "completed",
        error: null,
        result: {
          project_uuid: queued.projectId,
          output_docx_path: saved.storagePath,
          output_docx_storage_path: saved.storagePath,
          output_docx_size_bytes: saved.sizeBytes,
          email_recipient: versionContext.clientEmail,
          final_message: this.composeFinalMessage(analysis, versionContext.clientEmail),
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

  private async loadQuotationSource(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
  }): Promise<{ storagePath: string; fileName: string }> {
    const quotation = await this.documentArchiveService.getCurrentProjectVersionFile({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      versionLabel: params.versionLabel,
      fileKind: FileKind.QUOTATION_PDF,
    });

    if (!quotation) {
      throw new Error("PDF preventivo non trovato per questo progetto.");
    }

    if (!quotation.storagePath.startsWith("garage://")) {
      throw new Error("PDF preventivo non migrato su Garage.");
    }

    return {
      storagePath: quotation.storagePath,
      fileName: quotation.filename ?? "preventivo.pdf",
    };
  }

  private async loadVersionContext(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
  }): Promise<{ clientEmail: string | null }> {
    const prisma = PrismaClientManager.getClient();
    const version = await prisma.projectVersion.findFirst({
      where: {
        workspace_id: params.workspaceId,
        project_id: params.projectId,
        version_label: params.versionLabel,
        deleted_at: null,
      },
      select: {
        client: {
          select: {
            email: true,
          },
        },
      },
    });

    return {
      clientEmail: version?.client?.email?.trim() ? version.client.email.trim() : null,
    };
  }

  private composeFinalMessage(analysis: QuotationAnalysisResult, clientEmail: string | null): string {
    const title = analysis.structuredData.Title?.trim();
    const reference = analysis.structuredData.Reference?.trim();

    const detail = title
      ? `Titolo rilevato: ${title}`
      : reference
        ? `Riferimento rilevato: ${reference}`
        : "Dati strutturati rilevati correttamente.";

    if (clientEmail) {
      return `Preventivo DOCX generato con successo. ${detail} Cliente associato: ${clientEmail}.`;
    }

    return `Preventivo DOCX generato con successo. ${detail}`;
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
}
