import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { FileKind } from "../../document-archive/domain/FileKind.js";
import { PutProjectFileCommand } from "../../document-archive/dto/PutProjectFileCommand.js";
import { DocumentArchiveService } from "../../document-archive/services/DocumentArchiveService.js";
import { QuotationAnalysisResult } from "../domain/QuotationStructuredData.js";
import { QuotationOrchestratorRepository } from "../repositories/QuotationOrchestratorRepository.js";
import { NextOrchestratorQuotationAnalyzer } from "./NextOrchestratorQuotationAnalyzer.js";
import { QuotationEmailNotifier } from "./QuotationEmailNotifier.js";
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
    mail_delivery_status: string | null;
    mail_sent_at: string | null;
    mail_error: string | null;
    final_message: string | null;
  } | null;
}

interface QuotationJobPatch {
  status?: LegacyOrchestratorStatus;
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
}

export class LegacyQuotationOrchestratorService {
  private readonly documentArchiveService: DocumentArchiveService;
  private readonly quotationAnalyzer: NextOrchestratorQuotationAnalyzer;
  private readonly docxBuilder: QuotationDocxBuilder;
  private readonly repository: QuotationOrchestratorRepository;
  private readonly emailNotifier: QuotationEmailNotifier;
  private readonly runningJobs: Set<string>;

  public constructor(
    documentArchiveService: DocumentArchiveService,
    quotationAnalyzer: NextOrchestratorQuotationAnalyzer,
    docxBuilder: QuotationDocxBuilder,
    repository: QuotationOrchestratorRepository,
    emailNotifier: QuotationEmailNotifier,
  ) {
    this.documentArchiveService = documentArchiveService;
    this.quotationAnalyzer = quotationAnalyzer;
    this.docxBuilder = docxBuilder;
    this.repository = repository;
    this.emailNotifier = emailNotifier;
    this.runningJobs = new Set();
  }

  public async queueJob(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    requestedByUserId: string;
    clientName?: string | null;
  }): Promise<string> {
    const created = await this.repository.createJob({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      versionLabel: params.versionLabel,
      requestedByUserId: params.requestedByUserId,
      clientName: params.clientName ?? null,
      status: "QUEUED",
      progress: 5,
      message: "Job in coda.",
      step: "queued",
    });

    setTimeout(() => {
      void this.runJob(created.id);
    }, 100);

    return created.id;
  }

  public async getJob(jobId: string): Promise<{
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
  } | null> {
    const job = await this.repository.findJobById(jobId);
    if (!job) {
      return null;
    }

    return {
      job_id: job.id,
      status: this.toLegacyStatus(job.status),
      progress: job.progress,
      message: job.message ?? "",
      step: job.step ?? "",
      error: job.error,
      request: {
        project_uuid: job.projectId,
        client_name: job.clientName,
        metadata: {
          source: "birgus_internal_orchestrator",
          version_label: job.versionLabel,
        },
      },
      result: job.outputDocxPath || job.outputDocxStoragePath || job.outputDocxSizeBytes || job.emailRecipient || job.finalMessage
        ? {
            project_uuid: job.projectId,
            output_docx_path: job.outputDocxPath,
            output_docx_storage_path: job.outputDocxStoragePath,
            output_docx_size_bytes: job.outputDocxSizeBytes,
            email_recipient: job.emailRecipient,
            mail_delivery_status: job.mailDeliveryStatus,
            mail_sent_at: job.mailSentAt?.toISOString() ?? null,
            mail_error: job.mailError,
            final_message: job.finalMessage,
          }
        : null,
    };
  }

  public async resumePendingJobs(): Promise<void> {
    const recoverable = await this.repository.listRecoverableJobs();
    for (const job of recoverable) {
      if (this.runningJobs.has(job.id)) {
        continue;
      }

      setTimeout(() => {
        void this.runJob(job.id);
      }, 100);
    }
  }

  private async runJob(jobId: string): Promise<void> {
    if (this.runningJobs.has(jobId)) {
      return;
    }

    this.runningJobs.add(jobId);
    const queued = await this.repository.findJobById(jobId);
    if (!queued) {
      this.runningJobs.delete(jobId);
      return;
    }

    try {
      await this.patchJob(jobId, {
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

      await this.patchJob(jobId, {
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

      await this.patchJob(jobId, {
        status: "running",
        progress: 75,
        message: "Generazione DOCX del preventivo.",
        step: "docx_generation",
        error: null,
      });

      const docxBytes = await this.docxBuilder.build(analysis.structuredData);

      await this.patchJob(jobId, {
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

      await this.patchJob(jobId, {
        status: "running",
        progress: 95,
        message: versionContext.clientEmail
          ? `Invio preventivo via email a ${versionContext.clientEmail}.`
          : "Preventivo generato. Nessuna email cliente associata: invio saltato.",
        step: "mail_delivery",
        error: null,
        outputDocxPath: saved.storagePath,
        outputDocxStoragePath: saved.storagePath,
        outputDocxSizeBytes: saved.sizeBytes,
        emailRecipient: versionContext.clientEmail,
      });

      const mailOutcome = await this.deliverQuotationEmail({
        clientEmail: versionContext.clientEmail,
        clientName: versionContext.clientName,
        projectName: versionContext.projectName,
        versionLabel: queued.versionLabel,
        docxBytes,
      });

      await this.patchJob(jobId, {
        status: "completed",
        progress: 100,
        message: mailOutcome.message,
        step: "completed",
        error: null,
        outputDocxPath: saved.storagePath,
        outputDocxStoragePath: saved.storagePath,
        outputDocxSizeBytes: saved.sizeBytes,
        emailRecipient: versionContext.clientEmail,
        mailDeliveryStatus: mailOutcome.status,
        mailSentAt: mailOutcome.sentAt,
        mailError: mailOutcome.error,
        finalMessage: this.composeFinalMessage(analysis, versionContext.clientEmail, mailOutcome.message),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore durante l'elaborazione.";
      await this.patchJob(jobId, {
        status: "failed",
        progress: 100,
        message: "Elaborazione fallita.",
        step: "failed",
        error: message,
      });
    } finally {
      this.runningJobs.delete(jobId);
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
  }): Promise<{ clientEmail: string | null; clientName: string | null; projectName: string | null }> {
    const prisma = PrismaClientManager.getClient();
    const version = await prisma.projectVersion.findFirst({
      where: {
        workspace_id: params.workspaceId,
        project_id: params.projectId,
        version_label: params.versionLabel,
        deleted_at: null,
      },
      select: {
        project: {
          select: {
            name: true,
          },
        },
        client: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    return {
      clientEmail: version?.client?.email?.trim() ? version.client.email.trim() : null,
      clientName: this.composeClientName(version?.client?.first_name, version?.client?.last_name),
      projectName: version?.project?.name?.trim() ? version.project.name.trim() : null,
    };
  }

  private composeFinalMessage(analysis: QuotationAnalysisResult, clientEmail: string | null, mailSummary: string): string {
    const title = analysis.structuredData.Title?.trim();
    const reference = analysis.structuredData.Reference?.trim();

    const detail = title
      ? `Titolo rilevato: ${title}`
      : reference
        ? `Riferimento rilevato: ${reference}`
        : "Dati strutturati rilevati correttamente.";

    const clientDetail = clientEmail ? ` Cliente associato: ${clientEmail}.` : "";
    return `${mailSummary} ${detail}.${clientDetail}`.trim();
  }

  private async deliverQuotationEmail(params: {
    clientEmail: string | null;
    clientName: string | null;
    projectName: string | null;
    versionLabel: string;
    docxBytes: Buffer;
  }): Promise<{ status: string; message: string; sentAt: Date | null; error: string | null }> {
    if (!params.clientEmail) {
      return {
        status: "SKIPPED",
        message: "Preventivo DOCX generato con successo. Nessuna email cliente associata: invio saltato.",
        sentAt: null,
        error: null,
      };
    }

    try {
      await this.emailNotifier.sendQuotation({
        to: params.clientEmail,
        clientName: params.clientName,
        projectName: params.projectName,
        versionLabel: params.versionLabel,
        fileName: "preventivo.docx",
        docxBytes: params.docxBytes,
      });

      return {
        status: "SENT",
        message: `Preventivo DOCX generato e inviato con successo a ${params.clientEmail}.`,
        sentAt: new Date(),
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invio email non riuscito.";
      return {
        status: "FAILED",
        message: `Preventivo DOCX generato e salvato, ma invio email non riuscito verso ${params.clientEmail}.`,
        sentAt: null,
        error: message,
      };
    }
  }

  private composeClientName(firstName: string | null | undefined, lastName: string | null | undefined): string | null {
    const fullName = [firstName?.trim(), lastName?.trim()].filter((value) => Boolean(value)).join(" ").trim();
    return fullName.length > 0 ? fullName : null;
  }

  private async patchJob(jobId: string, patch: QuotationJobPatch): Promise<void> {
    await this.repository.updateJob(jobId, {
      status: patch.status?.toUpperCase(),
      progress: patch.progress,
      message: patch.message ?? null,
      step: patch.step ?? null,
      error: patch.error ?? null,
      outputDocxPath: patch.outputDocxPath ?? null,
      outputDocxStoragePath: patch.outputDocxStoragePath ?? null,
      outputDocxSizeBytes: patch.outputDocxSizeBytes ?? null,
      emailRecipient: patch.emailRecipient ?? null,
      mailDeliveryStatus: patch.mailDeliveryStatus ?? undefined,
      mailSentAt: patch.mailSentAt ?? undefined,
      mailError: patch.mailError ?? null,
      finalMessage: patch.finalMessage ?? null,
      startedAt: patch.status === "running" ? new Date() : undefined,
      completedAt: patch.status === "completed" || patch.status === "failed" ? new Date() : undefined,
    });
  }

  private toLegacyStatus(value: string): LegacyOrchestratorStatus {
    switch (value.toUpperCase()) {
      case "RUNNING":
        return "running";
      case "COMPLETED":
        return "completed";
      case "FAILED":
        return "failed";
      default:
        return "queued";
    }
  }
}
