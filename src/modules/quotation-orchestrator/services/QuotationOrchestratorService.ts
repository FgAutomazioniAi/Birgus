import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { FileKind } from "../../document-archive/domain/FileKind.js";
import { PutProjectFileCommand } from "../../document-archive/dto/PutProjectFileCommand.js";
import { DocumentArchiveService } from "../../document-archive/services/DocumentArchiveService.js";
import { DocumentIntelligenceService } from "../../document-intelligence/services/DocumentIntelligenceService.js";
import { NotificationService } from "../../notifications/services/NotificationService.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { QuotationAnalysisResult } from "../domain/QuotationStructuredData.js";
import { QuotationOrchestratorRepository } from "../repositories/QuotationOrchestratorRepository.js";
import { NextOrchestratorQuotationAnalyzer } from "./NextOrchestratorQuotationAnalyzer.js";
import { QuotationEmailNotifier } from "./QuotationEmailNotifier.js";
import { QuotationDocxBuilder } from "./QuotationDocxBuilder.js";
import { WorkflowService } from "../../workflows/services/WorkflowService.js";
import { ModuleWorkflowEntity, ModuleWorkflowNodeEntity } from "../../workflows/domain/ModuleWorkflowEntity.js";
import { Job } from "../../../worker/queue/Job.js";
import { JobQueue } from "../../../worker/queue/JobQueue.js";
import { QuotationJobPayload } from "../../../worker/services/QuotationOrchestratorWorker.js";

type OrchestratorJobStatus = "queued" | "running" | "completed" | "failed";

interface OrchestratorJobState {
  id: string;
  status: OrchestratorJobStatus;
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
  status?: OrchestratorJobStatus;
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

type QuotationStepAction =
  | "resolve_source"
  | "analyzing"
  | "docx_generation"
  | "mail_delivery"
  | "completed";

interface QuotationExecutionStep {
  action: QuotationStepAction;
  node?: ModuleWorkflowNodeEntity;
}

export class QuotationOrchestratorService {
  private static readonly QUOTATION_WORKFLOW_KEY = "quotation_document_pipeline";
  public static readonly JOB_NAME = "quotation.orchestrator";
  private readonly documentArchiveService: DocumentArchiveService;
  private readonly quotationAnalyzer: NextOrchestratorQuotationAnalyzer;
  private readonly docxBuilder: QuotationDocxBuilder;
  private readonly repository: QuotationOrchestratorRepository;
  private readonly emailNotifier: QuotationEmailNotifier;
  private readonly documentIntelligenceService: DocumentIntelligenceService;
  private readonly workflowService: WorkflowService;
  private readonly notificationService: NotificationService | null;
  private readonly jobQueue: JobQueue | null;
  private readonly runningJobs: Set<string>;

  public constructor(
    documentArchiveService: DocumentArchiveService,
    quotationAnalyzer: NextOrchestratorQuotationAnalyzer,
    docxBuilder: QuotationDocxBuilder,
    repository: QuotationOrchestratorRepository,
    emailNotifier: QuotationEmailNotifier,
    documentIntelligenceService: DocumentIntelligenceService,
    workflowService: WorkflowService,
    jobQueue?: JobQueue | null,
    notificationService?: NotificationService | null,
  ) {
    this.documentArchiveService = documentArchiveService;
    this.quotationAnalyzer = quotationAnalyzer;
    this.docxBuilder = docxBuilder;
    this.repository = repository;
    this.emailNotifier = emailNotifier;
    this.documentIntelligenceService = documentIntelligenceService;
    this.workflowService = workflowService;
    this.jobQueue = jobQueue ?? null;
    this.notificationService = notificationService ?? null;
    this.runningJobs = new Set();
  }

  public async queueJob(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    requestedByUserId: string;
    clientName?: string | null;
  }): Promise<string> {
    const projectName = await this.loadProjectName(params.workspaceId, params.projectId);
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

    await this.notify(
      params.workspaceId,
      projectName ?? "Progetti",
      `Analisi preventivo avviata (${params.versionLabel.toUpperCase()}).`,
    );

    if (this.jobQueue) {
      await this.jobQueue.enqueue(
        new Job<QuotationJobPayload>(
          this.buildQueueJobId(created.id),
          QuotationOrchestratorService.JOB_NAME,
          { jobId: created.id },
        ),
      );
    } else {
      setTimeout(() => {
        void this.executeJob(created.id);
      }, 100);
    }

    return created.id;
  }

  public async getJob(jobId: string): Promise<{
    job_id: string;
    status: OrchestratorJobStatus;
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
    result: OrchestratorJobState["result"];
  } | null> {
    const job = await this.repository.findJobById(jobId);
    if (!job) {
      return null;
    }

    return {
      job_id: job.id,
      status: this.toApiStatus(job.status),
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
      if (this.jobQueue) {
        await this.jobQueue.enqueue(
          new Job<QuotationJobPayload>(
            this.buildQueueJobId(job.id),
            QuotationOrchestratorService.JOB_NAME,
            { jobId: job.id },
          ),
        );
        continue;
      }

      setTimeout(() => {
        void this.executeJob(job.id);
      }, 100);
    }
  }

  public async executeJob(jobId: string): Promise<void> {
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
      const workflow = await this.resolveQuotationWorkflow(queued.workspaceId);
      const executionPlan = this.buildExecutionPlan(workflow);
      this.ensureRequiredPlanConsistency(executionPlan);

      const totalSteps = executionPlan.length;
      const progressForStep = (index: number): number => {
        const computed = Math.floor(((index + 1) / Math.max(totalSteps, 1)) * 95);
        return Math.max(10, Math.min(95, computed));
      };

      let quotationSource: { documentId: string; storagePath: string; fileName: string } | null = null;
      let analysis: QuotationAnalysisResult | null = null;
      let docxBytes: Buffer | null = null;
      let saved: { storagePath: string; sizeBytes: number | null } | null = null;
      let versionContext: { clientEmail: string | null; clientName: string | null; projectName: string | null } | null = null;
      let mailOutcome: { status: string; message: string; sentAt: Date | null; error: string | null } = {
        status: "SKIPPED",
        message: "Invio email non previsto dal workflow.",
        sentAt: null,
        error: null,
      };

      for (let i = 0; i < executionPlan.length; i += 1) {
        const step = executionPlan[i];

        if (step.action === "resolve_source") {
          await this.patchJob(jobId, {
            status: "running",
            progress: progressForStep(i),
            message: "Recupero preventivo PDF da archivio.",
            step: "resolve_source",
            error: null,
          });

          quotationSource = await this.loadQuotationSource({
            workspaceId: queued.workspaceId,
            projectId: queued.projectId,
            versionLabel: queued.versionLabel,
          });
          continue;
        }

        if (step.action === "analyzing") {
          if (!quotationSource) {
            throw new Error("Sorgente preventivo non disponibile per l'analisi.");
          }

          await this.patchJob(jobId, {
            status: "running",
            progress: progressForStep(i),
            message: "Analisi OCR/AI del preventivo in esecuzione.",
            step: "analyzing",
            error: null,
          });

          analysis = await this.quotationAnalyzer.analyze({
            workspaceId: queued.workspaceId,
            projectId: queued.projectId,
            storagePath: quotationSource.storagePath,
            fileName: quotationSource.fileName,
          });

          await this.refreshQuotationKnowledge({
            workspaceId: queued.workspaceId,
            documentId: quotationSource.documentId,
            projectId: queued.projectId,
            versionLabel: queued.versionLabel,
          });
          continue;
        }

        if (step.action === "docx_generation") {
          if (!analysis) {
            throw new Error("Dati strutturati mancanti: impossibile generare DOCX.");
          }

          await this.patchJob(jobId, {
            status: "running",
            progress: progressForStep(i),
            message: "Generazione DOCX del preventivo.",
            step: "docx_generation",
            error: null,
          });

          docxBytes = await this.docxBuilder.build(analysis.structuredData);

          await this.patchJob(jobId, {
            status: "running",
            progress: progressForStep(i),
            message: "Salvataggio documento generato in archivio.",
            step: "storing",
            error: null,
          });

          saved = await this.documentArchiveService.putProjectVersionFile(
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
          continue;
        }

        if (step.action === "mail_delivery") {
          versionContext = await this.loadVersionContext({
            workspaceId: queued.workspaceId,
            projectId: queued.projectId,
            versionLabel: queued.versionLabel,
          });

          await this.patchJob(jobId, {
            status: "running",
            progress: progressForStep(i),
            message: versionContext.clientEmail
              ? `Invio preventivo via email a ${versionContext.clientEmail}.`
              : "Preventivo generato. Nessuna email cliente associata: invio saltato.",
            step: "mail_delivery",
            error: null,
            outputDocxPath: saved?.storagePath ?? null,
            outputDocxStoragePath: saved?.storagePath ?? null,
            outputDocxSizeBytes: saved?.sizeBytes ?? null,
            emailRecipient: versionContext.clientEmail,
          });

          if (!docxBytes) {
            mailOutcome = {
              status: "SKIPPED",
              message: "Invio email saltato: DOCX non disponibile.",
              sentAt: null,
              error: null,
            };
          } else {
            mailOutcome = await this.deliverQuotationEmail({
              clientEmail: versionContext.clientEmail,
              clientName: versionContext.clientName,
              projectName: versionContext.projectName,
              versionLabel: queued.versionLabel,
              docxBytes,
            });
          }
        }
      }

      if (!versionContext) {
        versionContext = await this.loadVersionContext({
          workspaceId: queued.workspaceId,
          projectId: queued.projectId,
          versionLabel: queued.versionLabel,
        });
      }

      await this.patchJob(jobId, {
        status: "completed",
        progress: 100,
        message: mailOutcome.message,
        step: "completed",
        error: null,
        outputDocxPath: saved?.storagePath ?? null,
        outputDocxStoragePath: saved?.storagePath ?? null,
        outputDocxSizeBytes: saved?.sizeBytes ?? null,
        emailRecipient: versionContext.clientEmail,
        mailDeliveryStatus: mailOutcome.status,
        mailSentAt: mailOutcome.sentAt,
        mailError: mailOutcome.error,
        finalMessage: this.composeFinalMessage(analysis, versionContext.clientEmail, mailOutcome.message),
      });
      const deliverySummary = mailOutcome.status === "SENT"
        ? "Email inviata."
        : mailOutcome.status === "SKIPPED"
          ? "Email non inviata."
          : "Email non riuscita.";
      await this.notify(
        queued.workspaceId,
        versionContext.projectName ?? "Progetti",
        `Preventivo ${queued.versionLabel.toUpperCase()} completato. ${deliverySummary}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore durante l'elaborazione.";
      await this.patchJob(jobId, {
        status: "failed",
        progress: 100,
        message: "Elaborazione fallita.",
        step: "failed",
        error: message,
      });
      const versionContext = await this.loadVersionContext({
        workspaceId: queued.workspaceId,
        projectId: queued.projectId,
        versionLabel: queued.versionLabel,
      });
      await this.notify(
        queued.workspaceId,
        versionContext.projectName ?? "Progetti",
        `Preventivo ${queued.versionLabel.toUpperCase()} fallito: ${message}`,
      );
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  private buildQueueJobId(jobId: string): string {
    return `quotation:${jobId}`;
  }

  private async loadProjectName(workspaceId: string, projectId: string): Promise<string | null> {
    const prisma = PrismaClientManager.getClient();
    const project = await prisma.project.findFirst({
      where: {
        workspace_id: workspaceId,
        id: projectId,
        deleted_at: null,
      },
      select: {
        name: true,
      },
    });

    const name = project?.name?.trim();
    return name && name.length > 0 ? name : null;
  }

  private async loadQuotationSource(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
  }): Promise<{ documentId: string; storagePath: string; fileName: string }> {
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
      documentId: quotation.id,
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

  private async resolveQuotationWorkflow(workspaceId: string): Promise<ModuleWorkflowEntity> {
    try {
      const workflow = await this.workflowService.findWorkflowByKey(
        workspaceId,
        ModuleKey.PROJECT_MANAGEMENT,
        QuotationOrchestratorService.QUOTATION_WORKFLOW_KEY,
      );
      if (!workflow) {
        throw new Error("Workflow preventivo progetto non configurato.");
      }
      return workflow;
    } catch (error) {
      console.error("[QuotationOrchestratorService] Workflow lookup failed.", {
        workspaceId,
        workflowKey: QuotationOrchestratorService.QUOTATION_WORKFLOW_KEY,
        error,
      });
      throw error;
    }
  }

  private buildExecutionPlan(workflow: ModuleWorkflowEntity): QuotationExecutionStep[] {
    const enabledNodes = workflow.nodes.filter((node) => node.isEnabled || node.isRequired);
    if (enabledNodes.length === 0) {
      throw new Error("Workflow preventivo progetto vuoto o senza nodi attivi.");
    }

    const orderedNodeIds = this.computeOrderedNodeIds(workflow, enabledNodes);
    const nodeById = new Map(enabledNodes.map((node) => [node.id, node]));
    const steps: QuotationExecutionStep[] = [];
    const pushUnique = (action: QuotationStepAction, node?: ModuleWorkflowNodeEntity) => {
      if (steps.some((step) => step.action === action)) {
        return;
      }
      steps.push({ action, node });
    };

    pushUnique("resolve_source");
    for (const nodeId of orderedNodeIds) {
      const node = nodeById.get(nodeId);
      if (!node) {
        continue;
      }

      switch (node.nodeKey) {
        case "quotation_ocr_tool":
        case "quotation_structuring_agent":
          pushUnique("analyzing", node);
          break;
        case "quotation_docx_builder_tool":
          pushUnique("docx_generation", node);
          break;
        case "quotation_mail_delivery_tool":
          pushUnique("mail_delivery", node);
          break;
        default:
          break;
      }
    }

    pushUnique("completed");
    return steps;
  }

  private computeOrderedNodeIds(workflow: ModuleWorkflowEntity, nodes: ModuleWorkflowNodeEntity[]): string[] {
    const enabledNodeIds = new Set(nodes.map((node) => node.id));
    const outgoing = new Map<string, Array<{ target: string; orderNo: number }>>();
    const incomingCount = new Map<string, number>();

    for (const node of nodes) {
      outgoing.set(node.id, []);
      incomingCount.set(node.id, 0);
    }

    for (const edge of workflow.edges) {
      if (!edge.isEnabled) {
        continue;
      }
      if (!enabledNodeIds.has(edge.sourceNodeId) || !enabledNodeIds.has(edge.targetNodeId)) {
        continue;
      }

      const sourceLinks = outgoing.get(edge.sourceNodeId);
      if (!sourceLinks) {
        continue;
      }
      sourceLinks.push({ target: edge.targetNodeId, orderNo: edge.orderNo });
      incomingCount.set(edge.targetNodeId, (incomingCount.get(edge.targetNodeId) ?? 0) + 1);
    }

    for (const links of outgoing.values()) {
      links.sort((a, b) => a.orderNo - b.orderNo);
    }

    const queue: string[] = nodes
      .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
      .map((node) => node.id);
    const ordered: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift() as string;
      ordered.push(current);
      const links = outgoing.get(current) ?? [];
      for (const link of links) {
        const nextCount = (incomingCount.get(link.target) ?? 0) - 1;
        incomingCount.set(link.target, nextCount);
        if (nextCount === 0) {
          queue.push(link.target);
        }
      }
    }

    for (const node of nodes) {
      if (!ordered.includes(node.id)) {
        ordered.push(node.id);
      }
    }

    return ordered;
  }

  private ensureRequiredPlanConsistency(plan: QuotationExecutionStep[]): void {
    const hasAction = (action: QuotationStepAction) => plan.some((step) => step.action === action);

    if (!hasAction("resolve_source")) {
      throw new Error("Workflow non valido: step di input mancante.");
    }
    if (!hasAction("analyzing")) {
      throw new Error("Workflow non valido: step di analisi preventivo mancante.");
    }
    if (!hasAction("docx_generation")) {
      throw new Error("Workflow non valido: step generazione DOCX mancante.");
    }
  }

  private composeFinalMessage(analysis: QuotationAnalysisResult | null, clientEmail: string | null, mailSummary: string): string {
    const title = analysis?.structuredData.Title?.trim();
    const reference = analysis?.structuredData.Reference?.trim();

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

  private async refreshQuotationKnowledge(params: {
    workspaceId: string;
    documentId: string;
    projectId: string;
    versionLabel: string;
  }): Promise<void> {
    try {
      await this.documentIntelligenceService.refreshDocumentKnowledge(params.workspaceId, params.documentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Knowledge indexing error";
      console.error("[QuotationOrchestratorService] Unable to index quotation document knowledge", {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        versionLabel: params.versionLabel,
        documentId: params.documentId,
        message,
      });
    }
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

  private toApiStatus(value: string): OrchestratorJobStatus {
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

  private async notify(workspaceId: string, title: string, message: string): Promise<void> {
    if (!this.notificationService) {
      return;
    }

    try {
      await this.notificationService.createInfo({
        workspaceId,
        userId: null,
        moduleKey: ModuleKey.PROJECT_MANAGEMENT,
        title,
        message,
      });
    } catch (error) {
      console.error("[QuotationOrchestratorService] Unable to create notification", {
        workspaceId,
        title,
        message,
        error,
      });
    }
  }
}
