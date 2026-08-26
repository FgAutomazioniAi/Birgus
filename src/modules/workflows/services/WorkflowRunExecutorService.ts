import { Buffer } from "node:buffer";

import { Prisma, WorkflowStepStatus } from "@prisma/client";

import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { WorkflowRuntimeAccessPolicy } from "./WorkflowRuntimeAccessPolicy.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AiProviderSettingsService } from "../../ai-runtime/services/AiProviderSettingsService.js";
import { FileKind } from "../../document-archive/domain/FileKind.js";
import { PutProjectFileCommand } from "../../document-archive/dto/PutProjectFileCommand.js";
import { DocumentArchiveService } from "../../document-archive/services/DocumentArchiveService.js";
import { DEFAULT_KNOWLEDGE_MODE, normalizeKnowledgeMode, type KnowledgeMode } from "../../document-intelligence/domain/KnowledgeMode.js";
import { DocumentIntelligenceService } from "../../document-intelligence/services/DocumentIntelligenceService.js";
import { BackendPythonModulesClient } from "../../document-intelligence/services/BackendPythonModulesClient.js";
import { MailProviderSettingsService } from "../../mail-runtime/services/MailProviderSettingsService.js";
import { ConnectedAppsService } from "../../connected-apps/services/ConnectedAppsService.js";
import { NotificationService } from "../../notifications/services/NotificationService.js";
import { NextOrchestratorDdtAnalyzer } from "../../ddt-processing/services/NextOrchestratorDdtAnalyzer.js";
import { DdtAnalysisInput } from "../../ddt-processing/domain/DdtAnalysisInput.js";
import { NextOrchestratorQuotationAnalyzer } from "../../quotation-orchestrator/services/NextOrchestratorQuotationAnalyzer.js";
import { MeasureReportAnalysisInput, MeasureReportAnalyzer } from "../../measure-report/services/MeasureReportAnalyzer.js";
import { normalizeMeasureReportDocumentType } from "../../measure-report/services/MeasureReportDocumentTypes.js";
import { Job } from "../../../worker/queue/Job.js";
import { JobQueue } from "../../../worker/queue/JobQueue.js";
import { WorkflowGraphPlanner } from "./WorkflowGraphPlanner.js";
import { QueueWorkflowRunDispatcher, WorkflowRunJobPayload } from "./QueueWorkflowRunDispatcher.js";
import { ScheduledWorkflowDeliveryService, type ScheduledDeliveryChannel } from "./ScheduledWorkflowDeliveryService.js";

interface StepExecutionContext {
  workspaceId: string;
  userId: string | null;
  runId: string;
  workflowKey: string;
  moduleKey: string | null;
  knowledgeMode: KnowledgeMode;
  projectId: string | null;
  projectVersionLabel: string | null;
  projectVersionId: number | null;
  clientId: string | null;
  clientEmail: string | null;
  clientName: string | null;
  projectName: string | null;
  documentId: string | null;
  ddtDocumentId: string | null;
  measureReportDocumentId: string | null;
  quotationSource: {
    documentId: string;
    storagePath: string;
    fileName: string;
  } | null;
  ddtSource: {
    storagePath: string;
    fileName: string;
  } | null;
  measureReportSource: {
    storagePath: string;
    fileName: string;
    requestedDocumentType: string | null;
    effectiveDocumentType: string | null;
  } | null;
  inputPayload: Record<string, unknown> | null;
  nodeOutputs: Map<string, unknown>;
  incomingNodeKeys: Map<string, string[]>;
  outgoingNodeKeys: Map<string, string[]>;
  workflowNodesByKey: Map<string, WorkflowNodeRow>;
  scheduledTargetNodeKeys: Set<string>;
}

type ConditionPayload = Record<string, unknown>;

interface IncomingNodeOutputs {
  byNodeKey: Record<string, Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
}

interface WorkflowNodeRow {
  id: string;
  node_key: string;
  node_kind: string;
  is_enabled: boolean;
  is_required: boolean;
  input_kind: string | null;
  output_kind: string | null;
  configuration: Prisma.JsonValue | null;
  module_agent: { key: string; active_prompt: string; original_prompt: string; is_enabled: boolean; deleted_at: Date | null; module: { key: string } } | null;
  module_tool: { key: string; runtime_kind: string; handler_key: string; configuration: Prisma.JsonValue | null; is_enabled: boolean; deleted_at: Date | null; module: { key: string } } | null;
}

export class WorkflowRunExecutorService {
  private readonly documentArchiveService: DocumentArchiveService;
  private readonly documentIntelligenceService: DocumentIntelligenceService;
  private readonly quotationAnalyzer: NextOrchestratorQuotationAnalyzer;
  private readonly ddtAnalyzer: NextOrchestratorDdtAnalyzer;
  private readonly measureReportAnalyzer: MeasureReportAnalyzer;
  private readonly pythonModulesClient: BackendPythonModulesClient;
  private readonly aiProviderSettingsService: AiProviderSettingsService | null;
  private readonly mailProviderSettingsService: MailProviderSettingsService | null;
  private readonly connectedAppsService: ConnectedAppsService | null;
  private readonly notificationService: NotificationService | null;
  private readonly jobQueue: JobQueue | null;
  private readonly scheduledWorkflowDeliveryService: ScheduledWorkflowDeliveryService | null;
  private readonly runtimeAccessPolicy: WorkflowRuntimeAccessPolicy;
  private readonly graphPlanner = new WorkflowGraphPlanner();

  public constructor(params: {
    documentArchiveService: DocumentArchiveService;
    documentIntelligenceService: DocumentIntelligenceService;
    quotationAnalyzer: NextOrchestratorQuotationAnalyzer;
    ddtAnalyzer: NextOrchestratorDdtAnalyzer;
    measureReportAnalyzer: MeasureReportAnalyzer;
    pythonModulesClient: BackendPythonModulesClient;
    aiProviderSettingsService?: AiProviderSettingsService | null;
    mailProviderSettingsService?: MailProviderSettingsService | null;
    connectedAppsService?: ConnectedAppsService | null;
    jobQueue?: JobQueue | null;
    notificationService?: NotificationService | null;
    scheduledWorkflowDeliveryService?: ScheduledWorkflowDeliveryService | null;
    runtimeAccessPolicy: WorkflowRuntimeAccessPolicy;
  }) {
    this.documentArchiveService = params.documentArchiveService;
    this.documentIntelligenceService = params.documentIntelligenceService;
    this.quotationAnalyzer = params.quotationAnalyzer;
    this.ddtAnalyzer = params.ddtAnalyzer;
    this.measureReportAnalyzer = params.measureReportAnalyzer;
    this.pythonModulesClient = params.pythonModulesClient;
    this.aiProviderSettingsService = params.aiProviderSettingsService ?? null;
    this.mailProviderSettingsService = params.mailProviderSettingsService ?? null;
    this.connectedAppsService = params.connectedAppsService ?? null;
    this.jobQueue = params.jobQueue ?? null;
    this.notificationService = params.notificationService ?? null;
    this.scheduledWorkflowDeliveryService = params.scheduledWorkflowDeliveryService ?? null;
    this.runtimeAccessPolicy = params.runtimeAccessPolicy;
  }

  public async resumeRecoverableRuns(): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.moduleWorkflowRun.findMany({
      where: {
        status: {
          in: ["QUEUED", "RUNNING"],
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        queued_at: "asc",
      },
      take: 200,
    });

    for (const row of rows) {
      try {
        if (this.jobQueue) {
          await this.jobQueue.enqueue(
            new Job<WorkflowRunJobPayload>(
              this.buildQueueJobId(row.id),
              QueueWorkflowRunDispatcher.JOB_NAME,
              { runId: row.id },
            ),
          );
          continue;
        }

        await this.executeRun(row.id);
      } catch (error) {
        console.error("[WorkflowRunExecutorService] Unable to resume workflow run", {
          runId: row.id,
          error,
        });
      }
    }
  }

  public async executeRun(runId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const run = await prisma.moduleWorkflowRun.findFirst({
      where: {
        id: runId,
      },
      include: {
        workflow: {
          include: {
            module: {
              select: {
                key: true,
              },
            },
            nodes: {
              include: {
                module_agent: {
                  select: {
                    key: true,
                    active_prompt: true,
                    original_prompt: true,
                    is_enabled: true,
                    deleted_at: true,
                    module: { select: { key: true } },
                  },
                },
                module_tool: {
                  select: {
                    key: true,
                    runtime_kind: true,
                    handler_key: true,
                    configuration: true,
                    is_enabled: true,
                    deleted_at: true,
                    module: { select: { key: true } },
                  },
                },
              },
              orderBy: {
                created_at: "asc",
              },
            },
            edges: {
              orderBy: [{ order_no: "asc" }, { created_at: "asc" }],
            },
          },
        },
      },
    });

    if (!run) {
      return;
    }

    if (run.status !== "QUEUED" && run.status !== "RUNNING") {
      return;
    }

    await prisma.moduleWorkflowRun.update({
      where: {
        id: runId,
      },
      data: {
        status: "RUNNING",
        started_at: run.started_at ?? new Date(),
        error_message: null,
      },
    });
    await prisma.moduleWorkflowRunStep.deleteMany({
      where: {
        workflow_run_id: runId,
      },
    });

    const context = await this.buildContext(runId);
    const evaluateCondition = (payload: unknown) => this.evaluateCondition(payload as ConditionPayload | null, context);
    const orderedNodes = this.graphPlanner.buildExecutionOrder(run.workflow.nodes, run.workflow.edges, evaluateCondition);
    await this.runtimeAccessPolicy.ensureRunAllowed({
      workspaceId: run.workspace_id,
      requestedByUserId: run.requested_by_user_id,
      workflowModuleKey: run.workflow.module.key,
      nodes: orderedNodes.map((node) => ({
        nodeKey: node.node_key,
        agent: node.module_agent ? {
          moduleKey: node.module_agent.module.key,
          enabled: node.module_agent.is_enabled,
          deleted: node.module_agent.deleted_at !== null,
        } : null,
        tool: node.module_tool ? {
          moduleKey: node.module_tool.module.key,
          enabled: node.module_tool.is_enabled,
          deleted: node.module_tool.deleted_at !== null,
        } : null,
      })),
    });
    context.incomingNodeKeys = this.graphPlanner.buildIncomingNodeKeyMap(run.workflow.nodes, run.workflow.edges, evaluateCondition);
    context.outgoingNodeKeys = this.buildOutgoingNodeKeyMap(run.workflow.nodes, run.workflow.edges, evaluateCondition);
    context.workflowNodesByKey = new Map(run.workflow.nodes.map((node) => [node.node_key, node]));
    context.scheduledTargetNodeKeys = this.buildScheduledTargetNodeKeys(run.workflow.nodes, context.outgoingNodeKeys);

    let sequenceNo = 1;
    try {
      for (const node of orderedNodes) {
        await this.handlePreStepStatus(context, node.node_key);
        const step = await prisma.moduleWorkflowRunStep.create({
          data: {
            workspace_id: run.workspace_id,
            workflow_run_id: runId,
            workflow_node_id: node.id,
            sequence_no: sequenceNo,
            step_key: node.node_key,
            status: "RUNNING",
            started_at: new Date(),
            input_payload: this.toInputJson({
              nodeKey: node.node_key,
              nodeKind: node.node_kind,
              runtimeKind: node.module_tool?.runtime_kind ?? null,
              handlerKey: node.module_tool?.handler_key ?? null,
            }),
          },
        });

        try {
          const output = context.scheduledTargetNodeKeys.has(node.node_key)
            ? this.buildScheduledTargetSkipOutput(node)
            : await this.executeNode(context, node);
          context.nodeOutputs.set(node.node_key, output);
          await prisma.moduleWorkflowRunStep.update({
            where: {
              id: step.id,
            },
            data: {
              status: "SUCCEEDED",
              completed_at: new Date(),
              output_payload: this.toInputJson(output ?? {}),
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Step failed";
          await prisma.moduleWorkflowRunStep.update({
            where: {
              id: step.id,
            },
            data: {
              status: this.toFailureStatus(node.is_required),
              completed_at: new Date(),
              error_message: message,
            },
          });

          if (node.is_required) {
            throw error;
          }
        }

        sequenceNo += 1;
      }

      await prisma.moduleWorkflowRun.update({
        where: {
          id: runId,
        },
        data: {
          status: "COMPLETED",
          completed_at: new Date(),
          result_payload: this.toInputJson({
            workflowKey: context.workflowKey,
            outputs: Object.fromEntries(context.nodeOutputs.entries()),
          }),
          error_message: null,
        },
      });
      await this.notifyRunStatus(context, "completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow execution failed";
      await this.handleRunFailureStatus(context, message);
      await prisma.moduleWorkflowRun.update({
        where: {
          id: runId,
        },
        data: {
          status: "FAILED",
          completed_at: new Date(),
          error_message: message,
          result_payload: this.toInputJson({
            workflowKey: context.workflowKey,
            outputs: Object.fromEntries(context.nodeOutputs.entries()),
          }),
        },
      });
      await this.notifyRunStatus(context, "failed", message);
      throw error;
    }
  }

  private async buildContext(runId: string): Promise<StepExecutionContext> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.moduleWorkflowRun.findFirst({
      where: {
        id: runId,
      },
      include: {
        workflow: {
          include: {
            module: {
              select: {
                key: true,
              },
            },
          },
        },
        project_version: {
          select: {
            id: true,
            version_label: true,
            client: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
            project: {
              select: {
                name: true,
              },
            },
          },
        },
        ddt_document: {
          select: {
            id: true,
            original_filename: true,
            document: {
              select: {
                storage_path: true,
                filename: true,
              },
            },
          },
        },
        measure_report_document: {
          select: {
            id: true,
            original_filename: true,
            document_type_requested: true,
            document_type_effective: true,
            document: {
              select: {
                storage_path: true,
                filename: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      throw new Error("Workflow run not found.");
    }

    let quotationSource: StepExecutionContext["quotationSource"] = null;
    let resolvedProjectVersionLabel = row.project_version?.version_label ?? null;
    if (row.project_id) {
      const versionLabel = resolvedProjectVersionLabel
        ?? (typeof row.input_payload === "object" && row.input_payload && "versionLabel" in row.input_payload
          ? String((row.input_payload as Record<string, unknown>).versionLabel ?? "")
          : "")
        ?? "";
      if (versionLabel) {
        resolvedProjectVersionLabel = versionLabel;
        const quotation = await this.documentArchiveService.getCurrentProjectVersionFile({
          workspaceId: row.workspace_id,
          projectId: row.project_id,
          versionLabel,
          fileKind: FileKind.QUOTATION_PDF,
        });
        if (quotation) {
          quotationSource = {
            documentId: quotation.id,
            storagePath: quotation.storagePath,
            fileName: quotation.filename ?? "preventivo.pdf",
          };
        }
      }
    }

    const clientFirst = row.project_version?.client?.first_name?.trim() ?? "";
    const clientLast = row.project_version?.client?.last_name?.trim() ?? "";
    const clientName = `${clientFirst} ${clientLast}`.trim() || null;
    const ddtSource = row.ddt_document?.document?.storage_path
      ? {
          storagePath: row.ddt_document.document.storage_path,
          fileName: row.ddt_document.original_filename ?? row.ddt_document.document.filename ?? "document.pdf",
        }
      : null;
    const measureReportSource = row.measure_report_document?.document?.storage_path
      ? {
          storagePath: row.measure_report_document.document.storage_path,
          fileName: row.measure_report_document.original_filename ?? row.measure_report_document.document.filename ?? "document.pdf",
          requestedDocumentType: row.measure_report_document.document_type_requested ?? null,
          effectiveDocumentType: row.measure_report_document.document_type_effective ?? null,
        }
      : null;

    return {
      workspaceId: row.workspace_id,
      userId: row.requested_by_user_id,
      runId: row.id,
      workflowKey: row.workflow.key,
      moduleKey: row.workflow.module?.key ?? null,
      knowledgeMode: this.resolveKnowledgeMode(row.input_payload, row.workflow.configuration),
      projectId: row.project_id,
      projectVersionLabel: resolvedProjectVersionLabel,
      projectVersionId: row.project_version_id,
      clientId: row.project_version?.client?.id ?? row.client_id ?? null,
      clientEmail: row.project_version?.client?.email?.trim() || null,
      clientName,
      projectName: row.project_version?.project?.name?.trim() || null,
      documentId: row.document_id,
      ddtDocumentId: row.ddt_document_id,
      measureReportDocumentId: row.measure_report_document_id,
      quotationSource,
      ddtSource,
      measureReportSource,
      inputPayload: (row.input_payload ?? null) as Record<string, unknown> | null,
      nodeOutputs: new Map<string, unknown>(),
      incomingNodeKeys: new Map<string, string[]>(),
      outgoingNodeKeys: new Map<string, string[]>(),
      workflowNodesByKey: new Map<string, WorkflowNodeRow>(),
      scheduledTargetNodeKeys: new Set<string>(),
    };
  }

  private buildOutgoingNodeKeyMap(
    nodes: WorkflowNodeRow[],
    edges: Array<{
      source_node_id: string;
      target_node_id: string;
      condition_payload: Prisma.JsonValue | null;
      is_enabled: boolean;
    }>,
    evaluateCondition: (payload: unknown) => boolean,
  ): Map<string, string[]> {
    const keyById = new Map(nodes.map((node) => [node.id, node.node_key]));
    const outgoing = new Map<string, string[]>();
    for (const edge of edges) {
      if (!edge.is_enabled || !evaluateCondition(edge.condition_payload)) {
        continue;
      }
      const sourceKey = keyById.get(edge.source_node_id);
      const targetKey = keyById.get(edge.target_node_id);
      if (!sourceKey || !targetKey) {
        continue;
      }
      const list = outgoing.get(sourceKey) ?? [];
      list.push(targetKey);
      outgoing.set(sourceKey, list);
    }
    return outgoing;
  }

  private buildScheduledTargetNodeKeys(
    nodes: WorkflowNodeRow[],
    outgoingNodeKeys: Map<string, string[]>,
  ): Set<string> {
    const nodesByKey = new Map(nodes.map((node) => [node.node_key, node]));
    const claimed = new Set<string>();
    for (const node of nodes) {
      if (!this.isScheduleHandler(node.module_tool?.handler_key ?? null)) {
        continue;
      }
      const targetKeys = outgoingNodeKeys.get(node.node_key) ?? [];
      for (const targetKey of targetKeys) {
        const target = nodesByKey.get(targetKey);
        if (this.deliveryChannelFromHandler(target?.module_tool?.handler_key ?? null)) {
          claimed.add(targetKey);
        }
      }
    }
    return claimed;
  }

  private async executeNode(
    context: StepExecutionContext,
    node: WorkflowNodeRow,
  ): Promise<unknown> {
    if (node.node_kind === "INPUT") {
      if (node.node_key === "quotation_pdf_input") {
        return context.quotationSource;
      }
      if (node.node_key === "ddt_pdf_input") {
        return context.ddtSource;
      }
      if (node.node_key === "measure_report_pdf_input") {
        return context.measureReportSource;
      }
      if (node.input_kind === "document" || node.input_kind === "file") {
        const workflowFiles = this.toRecord(context.inputPayload?.workflow_files);
        const uploaded = this.toRecord(workflowFiles[node.node_key]);
        if (Object.keys(uploaded).length > 0) {
          return {
            file_name: uploaded.fileName ?? uploaded.file_name ?? null,
            content_type: uploaded.contentType ?? uploaded.content_type ?? null,
            file_base64: uploaded.fileBase64 ?? uploaded.file_base64 ?? null,
            size_bytes: uploaded.sizeBytes ?? uploaded.size_bytes ?? null,
          };
        }
      }
      const nodeConfig = this.toRecord(node.configuration);
      const inputText = this.firstString(
        nodeConfig.input_text,
        nodeConfig.inputText,
        nodeConfig.promptText,
        nodeConfig.text,
        context.inputPayload?.input_text,
        context.inputPayload?.text,
      );
      if (inputText) {
        return {
          ...nodeConfig,
          ...(context.inputPayload ?? {}),
          input_text: inputText,
        };
      }
      return context.inputPayload;
    }

    if (node.node_kind === "AGENT") {
      return this.executeAgentNode(context, node);
    }

    if (node.node_kind === "TOOL") {
      return this.executeToolNode(context, node);
    }

    if (node.node_kind === "OUTPUT") {
      return this.executeOutputNode(context, node);
    }

    return null;
  }

  private async executeAgentNode(
    context: StepExecutionContext,
    node: {
      node_key: string;
      configuration: Prisma.JsonValue | null;
      module_agent: { key: string; active_prompt: string; original_prompt: string } | null;
    },
  ): Promise<unknown> {
    if (node.node_key === "quotation_structuring_agent") {
      if (!context.quotationSource || !context.projectId) {
        throw new Error("Sorgente preventivo mancante per l'agente strutturazione.");
      }
      const analysis = await this.quotationAnalyzer.analyze({
        workspaceId: context.workspaceId,
        projectId: context.projectId,
        storagePath: context.quotationSource.storagePath,
        fileName: context.quotationSource.fileName,
      });
      return {
        structured_data: analysis.structuredData,
        raw_response: analysis.rawResponse,
      };
    }

    if (node.node_key === "ddt_analysis_agent") {
      if (!context.ddtDocumentId) {
        throw new Error("Documento DDT mancante per l'agente analisi.");
      }
      return this.ddtAnalyzer.analyze(context.ddtDocumentId);
    }

    if (node.node_key === "measure_report_analysis_agent") {
      if (!context.measureReportSource) {
        throw new Error("Documento Measure Report mancante per l'agente analisi.");
      }
      return this.measureReportAnalyzer.analyze({
        workspaceId: context.workspaceId,
        fileName: context.measureReportSource.fileName,
        storagePath: context.measureReportSource.storagePath,
        requestedDocumentType: context.measureReportSource.effectiveDocumentType
          ?? context.measureReportSource.requestedDocumentType,
      });
    }

    const prompt = String(node.module_agent?.active_prompt || node.module_agent?.original_prompt || "").trim();
    if (!prompt) {
      throw new Error(`Prompt agente mancante per il nodo ${node.node_key}.`);
    }

    const previousOutput = this.toRecord(this.findLatestNodeOutput(context));
    const incomingOutputs = this.findIncomingNodeOutputs(context, node.node_key);
    const nodeConfig = this.toRecord(node.configuration);
    const inputPayload = context.inputPayload ?? {};
    const inputText = this.firstString(
      nodeConfig.input_text,
      nodeConfig.inputText,
      nodeConfig.promptText,
      nodeConfig.text,
      inputPayload.input_text,
      inputPayload.text,
      previousOutput.extracted_text,
      previousOutput.reply,
      previousOutput.text,
      previousOutput.raw_output,
      ...this.pickIncomingStrings(incomingOutputs.items, ["extracted_text", "reply", "text", "raw_output"]),
    );

    if (!inputText) {
      throw new Error(`Input testuale mancante per il nodo agente ${node.node_key}.`);
    }

    return this.pythonModulesClient.execute("langchain_orchestrator", "chat", {
      instructions: prompt,
      input_text: inputText,
      previous_output: previousOutput,
      incoming_outputs: incomingOutputs.byNodeKey,
      ai_provider: await this.buildPythonAiProviderOverride(),
    });
  }

  private async executeToolNode(
    context: StepExecutionContext,
    node: WorkflowNodeRow,
  ): Promise<unknown> {
    const tool = node.module_tool;
    if (!tool) {
      throw new Error(`Tool non associato al nodo ${node.node_key}.`);
    }

    if (tool.runtime_kind === "PYTHON_MODULE") {
      const [moduleName, action] = tool.handler_key.split(".");
      if (!moduleName || !action) {
        throw new Error(`Handler tool non valido: ${tool.handler_key}`);
      }

      const input = await this.buildPythonToolInput(context, node, moduleName, action);
      return this.pythonModulesClient.execute(moduleName, action, input);
    }

    if (tool.runtime_kind === "BACKEND") {
      return this.executeBackendTool(context, node, tool.handler_key);
    }

    if (tool.runtime_kind === "NEXT_ORCHESTRATOR") {
      throw new Error(`Runtime tool non ancora implementato: ${tool.runtime_kind}`);
    }

    throw new Error(`Runtime tool non supportato: ${tool.runtime_kind}`);
  }

  private async buildPythonToolInput(
    context: StepExecutionContext,
    node: WorkflowNodeRow,
    moduleName: string,
    action: string,
  ): Promise<Record<string, unknown>> {
    if (moduleName === "ocr_engine" && action === "extract_text_from_pdf_storage") {
      const source = context.quotationSource ?? context.ddtSource ?? context.measureReportSource;
      const previousOutput = this.toRecord(this.findLatestNodeOutput(context));
      const incomingOutputs = this.findIncomingNodeOutputs(context, node.node_key);
      const storagePath = this.firstString(
        source?.storagePath,
        previousOutput.storage_path,
        previousOutput.storagePath,
        ...this.pickIncomingStrings(incomingOutputs.items, ["storage_path", "storagePath"]),
      );
      if (storagePath) {
        return {
          storage_path: storagePath,
        };
      }
      const fileBase64 = this.firstString(
        previousOutput.file_base64,
        previousOutput.fileBase64,
        previousOutput.pdf_base64,
        previousOutput.document_base64,
        ...this.pickIncomingStrings(incomingOutputs.items, ["file_base64", "fileBase64", "pdf_base64", "document_base64"]),
      );
      if (!fileBase64) {
        throw new Error("Sorgente PDF mancante per OCR.");
      }
      return {
        file_base64: fileBase64,
        file_name: this.firstString(
          previousOutput.file_name,
          previousOutput.fileName,
          ...this.pickIncomingStrings(incomingOutputs.items, ["file_name", "fileName"]),
        ),
        content_type: this.firstString(
          previousOutput.content_type,
          previousOutput.contentType,
          ...this.pickIncomingStrings(incomingOutputs.items, ["content_type", "contentType"]),
        ),
      };
    }

    if (moduleName === "docx_engine" && action === "build_quotation_docx") {
      const structured = this.findNodeOutput(context, "quotation_structuring_agent") as Record<string, unknown> | null;
      const structuredData = structured?.structured_data;
      if (!structuredData || typeof structuredData !== "object") {
        throw new Error("Dati strutturati mancanti per generazione DOCX.");
      }

      return {
        file_name: "preventivo.docx",
        structured_data: structuredData,
      };
    }

    if (moduleName === "mail_engine" && action === "send_quotation_email") {
      const docxOutputEnvelope = this.findNodeOutput(context, "quotation_docx_builder_tool") as Record<string, unknown> | null;
      const docxOutput = this.unwrapPythonOutput(docxOutputEnvelope);
      const docxBase64 = typeof docxOutput.docx_base64 === "string" ? docxOutput.docx_base64 : "";
      if (!docxBase64) {
        throw new Error("DOCX base64 mancante per invio email.");
      }

      if (!context.clientEmail) {
        return {
          skipped: true,
        };
      }

      return {
        to: context.clientEmail,
        client_name: context.clientName,
        project_name: context.projectName,
        version_label: context.projectVersionLabel ?? "v1",
        file_name: "preventivo.docx",
        docx_base64: docxBase64,
        mail_provider: await this.buildPythonMailProviderOverride(),
      };
    }

    const nodeConfig = this.toRecord(node.configuration);
    const previousOutput = this.toRecord(this.findLatestNodeOutput(context));
    const incomingOutputs = this.findIncomingNodeOutputs(context, node.node_key);
    const inputPayload = context.inputPayload ?? {};

    if (moduleName === "langchain_orchestrator") {
      return await this.buildLangchainToolInput(action, nodeConfig, inputPayload, previousOutput, incomingOutputs);
    }

    if (moduleName === "docx_engine" && action === "generate_document") {
      return this.buildGenericDocumentInput(nodeConfig, inputPayload, previousOutput, incomingOutputs);
    }

    if (moduleName === "mail_engine" && action === "send_email") {
      return await this.buildGenericMailInput(context, nodeConfig, inputPayload, previousOutput, incomingOutputs);
    }

    if (moduleName === "messaging_engine" && action === "send_telegram") {
      return await this.buildTelegramInput(context, nodeConfig, inputPayload, previousOutput, incomingOutputs);
    }

    if (moduleName === "messaging_engine" && action === "send_whatsapp") {
      return this.buildWhatsappInput(nodeConfig, inputPayload, previousOutput, incomingOutputs);
    }

    return {
      ...nodeConfig,
      ...inputPayload,
      previous_output: previousOutput,
      incoming_outputs: incomingOutputs.byNodeKey,
    };
  }

  private async buildLangchainToolInput(
    action: string,
    nodeConfig: Record<string, unknown>,
    inputPayload: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    incomingOutputs: IncomingNodeOutputs,
  ): Promise<Record<string, unknown>> {
    const merged = {
      ...nodeConfig,
      ...inputPayload,
      previous_output: previousOutput,
      incoming_outputs: incomingOutputs.byNodeKey,
      ai_provider: await this.buildPythonAiProviderOverride(),
    };

    if (action === "chat") {
      return {
        ...merged,
        input_text: this.firstString(
          nodeConfig.input_text,
          inputPayload.input_text,
          previousOutput.reply,
          previousOutput.extracted_text,
          previousOutput.text,
          previousOutput.raw_output,
          ...this.pickIncomingStrings(incomingOutputs.items, ["reply", "extracted_text", "text", "raw_output"]),
        ),
      };
    }

    if (action === "structure_text") {
      return {
        ...merged,
        extracted_text: this.firstString(
          nodeConfig.extracted_text,
          inputPayload.extracted_text,
          previousOutput.extracted_text,
          previousOutput.reply,
          previousOutput.text,
          previousOutput.raw_output,
          ...this.pickIncomingStrings(incomingOutputs.items, ["extracted_text", "reply", "text", "raw_output"]),
        ),
      };
    }

    if (action === "compose_email") {
      return {
        ...merged,
        context: this.firstString(
          nodeConfig.context,
          inputPayload.context,
          previousOutput.reply,
          previousOutput.raw_output,
          previousOutput.text,
          previousOutput.extracted_text,
          ...this.pickIncomingStrings(incomingOutputs.items, ["reply", "raw_output", "text", "extracted_text"]),
        ),
      };
    }

    return merged;
  }

  private async buildPythonAiProviderOverride(): Promise<Record<string, unknown> | null> {
    if (!this.aiProviderSettingsService) {
      return null;
    }

    const config = await this.aiProviderSettingsService.getRuntimeConfig();
    const override: Record<string, unknown> = {};
    if (typeof config.baseUrl === "string" && config.baseUrl.trim()) {
      override.base_url = config.baseUrl.trim();
    }
    if (typeof config.chatModel === "string" && config.chatModel.trim()) {
      override.chat_model = config.chatModel.trim();
    }
    if (typeof config.temperature === "number" && Number.isFinite(config.temperature)) {
      override.temperature = config.temperature;
    }
    if (typeof config.timeoutMs === "number" && Number.isFinite(config.timeoutMs) && config.timeoutMs > 0) {
      override.timeout_ms = Math.trunc(config.timeoutMs);
    }

    return Object.keys(override).length > 0 ? override : null;
  }

  private async buildPythonMailProviderOverride(): Promise<Record<string, unknown> | null> {
    if (!this.mailProviderSettingsService) {
      return null;
    }

    const config = await this.mailProviderSettingsService.getRuntimeConfig();
    const override: Record<string, unknown> = {
      provider: config.provider,
      from: config.from,
    };

    if (config.provider === "smtp") {
      override.smtp_host = config.smtpHost;
      override.smtp_port = config.smtpPort;
      override.smtp_secure = config.smtpSecure;
      override.smtp_user = config.smtpUser;
      override.smtp_pass = config.smtpPass;
    }
    if (config.provider === "resend") {
      override.resend_api_key = config.resendApiKey;
    }

    return override;
  }

  private buildGenericDocumentInput(
    nodeConfig: Record<string, unknown>,
    inputPayload: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    incomingOutputs: IncomingNodeOutputs,
  ): Record<string, unknown> {
    return {
      ...nodeConfig,
      ...inputPayload,
      previous_output: previousOutput,
      incoming_outputs: incomingOutputs.byNodeKey,
      content: this.firstValue(
        nodeConfig.content,
        inputPayload.content,
        previousOutput.reply,
        previousOutput.text,
        previousOutput.raw_output,
        previousOutput.extracted_text,
        previousOutput.structured_data,
        ...this.pickIncomingValues(incomingOutputs.items, ["reply", "text", "raw_output", "extracted_text", "structured_data"]),
      ),
      title: this.firstString(nodeConfig.title, inputPayload.title),
      format: this.firstString(nodeConfig.format, inputPayload.format) || "docx",
      file_name: this.firstString(
        nodeConfig.file_name,
        nodeConfig.filename,
        inputPayload.file_name,
        inputPayload.filename,
        previousOutput.file_name,
      ),
    };
  }

  private async buildGenericMailInput(
    context: StepExecutionContext,
    nodeConfig: Record<string, unknown>,
    inputPayload: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    incomingOutputs: IncomingNodeOutputs,
  ): Promise<Record<string, unknown>> {
    return {
      ...nodeConfig,
      ...inputPayload,
      previous_output: previousOutput,
      incoming_outputs: incomingOutputs.byNodeKey,
      mail_provider: await this.buildPythonMailProviderOverride(),
      to: this.firstString(nodeConfig.to, inputPayload.to, context.clientEmail),
      subject: this.firstString(
        nodeConfig.subject,
        inputPayload.subject,
        previousOutput.subject,
        ...this.pickIncomingStrings(incomingOutputs.items, ["subject"]),
      ),
      text: this.firstString(
        nodeConfig.text,
        inputPayload.text,
        previousOutput.text,
        previousOutput.reply,
        previousOutput.raw_output,
        ...this.pickIncomingStrings(incomingOutputs.items, ["text", "reply", "raw_output"]),
      ),
      attachments: this.resolveMailAttachments(nodeConfig, inputPayload, previousOutput, incomingOutputs.items),
    };
  }

  private async buildTelegramInput(
    context: StepExecutionContext,
    nodeConfig: Record<string, unknown>,
    inputPayload: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    incomingOutputs: IncomingNodeOutputs,
  ): Promise<Record<string, unknown>> {
    const fallbackChatId = this.firstString(nodeConfig.chat_id, nodeConfig.chatId, inputPayload.chat_id, inputPayload.chatId);
    const telegramChannelId = nodeConfig.telegram_channel_id
      ?? nodeConfig.telegramChannelId
      ?? inputPayload.telegram_channel_id
      ?? inputPayload.telegramChannelId;
    const chatId = this.connectedAppsService
      ? await this.connectedAppsService.resolveTelegramChatId({
          workspaceId: context.workspaceId,
          userId: context.userId,
          channelId: telegramChannelId,
          fallbackChatId,
        })
      : fallbackChatId;

    return {
      ...nodeConfig,
      ...inputPayload,
      previous_output: previousOutput,
      incoming_outputs: incomingOutputs.byNodeKey,
      chat_id: chatId,
      text: this.firstString(
        nodeConfig.text,
        nodeConfig.message,
        inputPayload.text,
        inputPayload.message,
        previousOutput.text,
        previousOutput.reply,
        previousOutput.raw_output,
        ...this.pickIncomingStrings(incomingOutputs.items, ["text", "reply", "raw_output"]),
      ),
    };
  }

  private buildWhatsappInput(
    nodeConfig: Record<string, unknown>,
    inputPayload: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    incomingOutputs: IncomingNodeOutputs,
  ): Record<string, unknown> {
    return {
      ...nodeConfig,
      ...inputPayload,
      previous_output: previousOutput,
      incoming_outputs: incomingOutputs.byNodeKey,
      to: this.firstString(nodeConfig.to, nodeConfig.phone, inputPayload.to, inputPayload.phone),
      text: this.firstString(
        nodeConfig.text,
        nodeConfig.message,
        inputPayload.text,
        inputPayload.message,
        previousOutput.text,
        previousOutput.reply,
        previousOutput.raw_output,
        ...this.pickIncomingStrings(incomingOutputs.items, ["text", "reply", "raw_output"]),
      ),
    };
  }

  private async executeScheduleTool(context: StepExecutionContext, node: WorkflowNodeRow): Promise<unknown> {
    if (!this.scheduledWorkflowDeliveryService) {
      throw new Error("Servizio scheduling workflow non configurato.");
    }

    const nodeConfig = this.toRecord(node.configuration);
    const runAtText = this.firstString(
      nodeConfig.scheduleWhen,
      nodeConfig.schedule_when,
      nodeConfig.run_at,
      nodeConfig.runAt,
      nodeConfig.when,
    );
    if (!runAtText) {
      throw new Error("Data/ora mancante per nodo Schedule.");
    }

    const runAt = new Date(runAtText);
    if (Number.isNaN(runAt.getTime())) {
      throw new Error("Data/ora Schedule non valida.");
    }

    const targetNodeKeys = context.outgoingNodeKeys.get(node.node_key) ?? [];
    const targetNodes = targetNodeKeys
      .map((key) => context.workflowNodesByKey.get(key) ?? null)
      .filter((target): target is WorkflowNodeRow => Boolean(target))
      .filter((target) => this.deliveryChannelFromHandler(target.module_tool?.handler_key ?? null) !== null);

    if (targetNodes.length === 0) {
      return {
        status: "skipped",
        reason: "no_delivery_node_connected",
      };
    }

    const previousOutput = this.toRecord(this.findLatestNodeOutput(context));
    const incomingOutputs = this.findIncomingNodeOutputs(context, node.node_key);
    const inputPayload = context.inputPayload ?? {};
    const repeatEverySeconds = this.resolveRepeatEverySeconds(nodeConfig);
    const scheduled = [];

    for (const target of targetNodes) {
      const handlerKey = target.module_tool?.handler_key ?? "";
      const channel = this.deliveryChannelFromHandler(handlerKey);
      if (!channel) {
        continue;
      }
      const targetConfig = this.toRecord(target.configuration);
      const delivery = await this.buildScheduledDeliveryPayload(
        context,
        channel,
        targetConfig,
        inputPayload,
        previousOutput,
        incomingOutputs,
      );
      const row = await this.scheduledWorkflowDeliveryService.schedule({
        workspaceId: context.workspaceId,
        workflowRunId: context.runId,
        workflowNodeId: target.id,
        channel,
        recipient: delivery.recipient,
        subject: delivery.subject,
        message: delivery.message,
        attachments: delivery.attachments,
        providerPayload: delivery.providerPayload,
        runAt,
        repeatEverySeconds,
      });
      scheduled.push({
        id: row.id,
        nodeKey: target.node_key,
        channel: row.channel,
        recipient: row.recipient,
        nextRunAt: row.nextRunAt.toISOString(),
        repeatEverySeconds,
      });
    }

    return {
      status: scheduled.length > 0 ? "scheduled" : "skipped",
      scheduled,
    };
  }

  private async buildScheduledDeliveryPayload(
    context: StepExecutionContext,
    channel: ScheduledDeliveryChannel,
    nodeConfig: Record<string, unknown>,
    inputPayload: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    incomingOutputs: IncomingNodeOutputs,
  ): Promise<{
    recipient: string;
    subject?: string | null;
    message: string;
    attachments?: unknown;
    providerPayload?: unknown;
  }> {
    if (channel === "email") {
      const input = await this.buildGenericMailInput(context, nodeConfig, inputPayload, previousOutput, incomingOutputs);
      return {
        recipient: String(input.to ?? ""),
        subject: typeof input.subject === "string" ? input.subject : "Messaggio programmato",
        message: String(input.text ?? ""),
        attachments: input.attachments,
        providerPayload: input.mail_provider,
      };
    }

    if (channel === "telegram") {
      const input = await this.buildTelegramInput(context, nodeConfig, inputPayload, previousOutput, incomingOutputs);
      return {
        recipient: String(input.chat_id ?? ""),
        message: String(input.text ?? ""),
      };
    }

    const input = this.buildWhatsappInput(nodeConfig, inputPayload, previousOutput, incomingOutputs);
    return {
      recipient: String(input.to ?? ""),
      message: String(input.text ?? ""),
    };
  }

  private resolveRepeatEverySeconds(nodeConfig: Record<string, unknown>): number | null {
    const explicit = Number(nodeConfig.repeat_every_seconds ?? nodeConfig.repeatEverySeconds);
    if (Number.isFinite(explicit) && explicit >= 60) {
      return Math.trunc(explicit);
    }

    const value = Number(nodeConfig.scheduleRepeatValue ?? nodeConfig.repeat_value ?? nodeConfig.repeatValue);
    const unit = this.firstString(
      nodeConfig.scheduleRepeatUnit,
      nodeConfig.repeat_unit,
      nodeConfig.repeatUnit,
    );
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    if (unit === "days" || unit === "day" || unit === "giorni") {
      return Math.trunc(value * 86_400);
    }
    return Math.trunc(value * 3_600);
  }

  private deliveryChannelFromHandler(handlerKey: string | null): ScheduledDeliveryChannel | null {
    if (handlerKey === "mail_engine.send_email") {
      return "email";
    }
    if (handlerKey === "messaging_engine.send_telegram") {
      return "telegram";
    }
    if (handlerKey === "messaging_engine.send_whatsapp") {
      return "whatsapp";
    }
    return null;
  }

  private isScheduleHandler(handlerKey: string | null): boolean {
    return handlerKey === "workflow_scheduler.schedule_report_delivery";
  }

  private buildScheduledTargetSkipOutput(node: WorkflowNodeRow): Record<string, unknown> {
    return {
      status: "scheduled_by_previous_schedule_node",
      nodeKey: node.node_key,
      message: "Nodo pianificato da uno Schedule precedente: non inviato immediatamente.",
    };
  }

  private async executeBackendTool(
    context: StepExecutionContext,
    node: WorkflowNodeRow,
    handlerKey: string,
  ): Promise<unknown> {
    if (handlerKey === "workflow_scheduler.schedule_report_delivery") {
      return this.executeScheduleTool(context, node);
    }

    if (handlerKey === "document_intelligence.analyze_document_set") {
      return this.executeDocumentSetAnalysisTool(context, node);
    }

    if (handlerKey === "document_intelligence.refresh_document_knowledge") {
      const documentId = context.documentId
        ?? context.quotationSource?.documentId
        ?? (await this.findDocumentIdFromDdt(context.ddtDocumentId))
        ?? null;
      if (!documentId) {
        throw new Error("documentId mancante per refresh knowledge.");
      }
      const knowledge = await this.documentIntelligenceService.refreshDocumentKnowledge(context.workspaceId, documentId);
      return {
        knowledgeDocumentId: knowledge.id,
      };
    }

    if (handlerKey === "document_intelligence.search_workspace_knowledge") {
      const query = String(context.inputPayload?.query ?? "").trim();
      if (!query) {
        return { results: [] };
      }
      const results = await this.documentIntelligenceService.searchWorkspaceKnowledge({
        workspaceId: context.workspaceId,
        query,
      });
      return {
        results,
      };
    }

    throw new Error(`Backend handler non supportato: ${handlerKey}`);
  }

  private async executeDocumentSetAnalysisTool(
    context: StepExecutionContext,
    node: WorkflowNodeRow,
  ): Promise<unknown> {
    const nodeConfig = this.toRecord(node.configuration);
    const previousOutput = this.toRecord(this.findLatestNodeOutput(context));
    const incomingOutputs = this.findIncomingNodeOutputs(context, node.node_key);
    const inputPayload = context.inputPayload ?? {};
    const documentIds = this.firstStringArray(
      nodeConfig.document_ids,
      nodeConfig.documentIds,
      inputPayload.document_ids,
      inputPayload.documentIds,
      previousOutput.document_ids,
      previousOutput.documentIds,
      ...this.pickIncomingValues(incomingOutputs.items, ["document_ids", "documentIds"]),
    );
    const fallbackDocumentId = this.firstString(
      nodeConfig.document_id,
      nodeConfig.documentId,
      inputPayload.document_id,
      inputPayload.documentId,
      context.documentId,
    );
    const resolvedDocumentIds = documentIds.length > 0 ? documentIds : (fallbackDocumentId ? [fallbackDocumentId] : []);
    const prompt = this.firstString(
      nodeConfig.prompt,
      nodeConfig.question,
      inputPayload.prompt,
      inputPayload.question,
      previousOutput.prompt,
      previousOutput.question,
      previousOutput.text,
      previousOutput.reply,
      ...this.pickIncomingStrings(incomingOutputs.items, ["prompt", "question", "text", "reply"]),
    );

    return this.documentIntelligenceService.analyzeDocumentSet({
      workspaceId: context.workspaceId,
      documentIds: resolvedDocumentIds,
      prompt,
      knowledgeMode: context.knowledgeMode,
      useDeepReasoning: nodeConfig.use_deep_reasoning === true || nodeConfig.useDeepReasoning === true,
      aiProvider: await this.buildPythonAiProviderOverride(),
    });
  }

  private async executeOutputNode(
    context: StepExecutionContext,
    node: WorkflowNodeRow,
  ): Promise<unknown> {
    if (node.output_kind === "quotation_delivery") {
      const docxOutputEnvelope = this.findNodeOutput(context, "quotation_docx_builder_tool") as Record<string, unknown> | null;
      const docxOutput = this.unwrapPythonOutput(docxOutputEnvelope);
      const docxBase64 = typeof docxOutput.docx_base64 === "string" ? docxOutput.docx_base64 : "";
      if (!docxBase64 || !context.projectId || !context.projectVersionLabel) {
        return {
          persisted: false,
          reason: "missing_docx_or_project_context",
        };
      }

      const bytes = Buffer.from(docxBase64, "base64");
      const saved = await this.documentArchiveService.putProjectVersionFile(
        new PutProjectFileCommand({
          workspaceId: context.workspaceId,
          projectId: context.projectId,
          versionLabel: context.projectVersionLabel,
          fileKind: FileKind.QUOTATION_DOCX,
          fileName: "preventivo.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bytes,
          uploadedByUserId: null,
        }),
      );

      return {
        persisted: true,
        storagePath: saved.storagePath,
        sizeBytes: saved.sizeBytes,
      };
    }

    if (node.output_kind === "ddt_analysis_result") {
      const analysis = this.findNodeOutput(context, "ddt_analysis_agent") as DdtAnalysisInput | null;
      if (!context.ddtDocumentId || !analysis) {
        return {
          persisted: false,
          reason: "missing_ddt_context_or_analysis",
        };
      }

      await this.persistDdtAnalysis(context.workspaceId, context.ddtDocumentId, analysis);
      return {
        persisted: true,
        ddtDocumentId: context.ddtDocumentId,
      };
    }

    if (node.output_kind === "measure_report_analysis_result") {
      const analysis = this.findNodeOutput(context, "measure_report_analysis_agent") as MeasureReportAnalysisInput | null;
      if (!context.measureReportDocumentId || !analysis) {
        return {
          persisted: false,
          reason: "missing_measure_report_context_or_analysis",
        };
      }

      await this.persistMeasureReportAnalysis(context.workspaceId, context.measureReportDocumentId, analysis);
      return {
        persisted: true,
        measureReportDocumentId: context.measureReportDocumentId,
      };
    }

    return {
      nodeKey: node.node_key,
      outputKind: node.output_kind,
      persisted: false,
    };
  }

  private async persistDdtAnalysis(workspaceId: string, ddtDocumentId: string, analysis: DdtAnalysisInput): Promise<void> {
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
          raw_response: this.toInputJson(analysis.rawResponse ?? {}),
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
          raw_response: this.toInputJson(analysis.rawResponse ?? {}),
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

      await tx.ddtDocument.update({
        where: {
          id: ddtDocumentId,
        },
        data: {
          workspace_id: workspaceId,
          status: "READY",
          last_error: null,
        },
      });
    });
  }

  private async persistMeasureReportAnalysis(
    workspaceId: string,
    measureReportDocumentId: string,
    analysis: MeasureReportAnalysisInput,
  ): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.$transaction(async (tx) => {
      const result = await tx.measureReportAnalysisResult.upsert({
        where: {
          measure_report_document_id: measureReportDocumentId,
        },
        update: {
          document_type_used: analysis.documentTypeUsed,
          prompt_agent_key: analysis.promptAgentKey,
          rows_count: analysis.rows.length,
          summary: analysis.summary,
          raw_output: analysis.rawOutput,
          raw_response: this.toInputJson(analysis.rawResponse ?? {}),
          execution_metadata: this.toInputJson(analysis.executionMetadata ?? {}),
        },
        create: {
          measure_report_document_id: measureReportDocumentId,
          document_type_used: analysis.documentTypeUsed,
          prompt_agent_key: analysis.promptAgentKey,
          rows_count: analysis.rows.length,
          summary: analysis.summary,
          raw_output: analysis.rawOutput,
          raw_response: this.toInputJson(analysis.rawResponse ?? {}),
          execution_metadata: this.toInputJson(analysis.executionMetadata ?? {}),
        },
        select: {
          id: true,
        },
      });

      await tx.measureReportAnalysisRow.deleteMany({
        where: {
          analysis_result_id: result.id,
        },
      });

      if (analysis.rows.length > 0) {
        await tx.measureReportAnalysisRow.createMany({
          data: analysis.rows.map((row, index) => ({
            analysis_result_id: result.id,
            row_index: index + 1,
            row_text: row.rowText,
            note: row.note,
            page_hint: row.pageHint,
            raw_payload: this.toInputJson(row.rawPayload ?? {}),
          })),
        });
      }

      await tx.measureReportDocument.update({
        where: {
          id: measureReportDocumentId,
        },
        data: {
          workspace_id: workspaceId,
          status: "READY",
          document_type_effective: normalizeMeasureReportDocumentType(analysis.documentTypeUsed),
          last_error: null,
        },
      });
    });
  }

  private async handlePreStepStatus(context: StepExecutionContext, nodeKey: string): Promise<void> {
    if (context.ddtDocumentId) {
      if (nodeKey === "ddt_ocr_tool") {
        await this.updateDdtDocumentStatus(context.ddtDocumentId, "OCR_PROCESSING");
        return;
      }
      if (nodeKey === "ddt_analysis_agent") {
        await this.updateDdtDocumentStatus(context.ddtDocumentId, "AI_PROCESSING");
        return;
      }
    }

    if (context.measureReportDocumentId && nodeKey === "measure_report_analysis_agent") {
      await this.updateMeasureReportDocumentStatus(context.measureReportDocumentId, "AI_PROCESSING");
    }
  }

  private async handleRunFailureStatus(context: StepExecutionContext, message: string): Promise<void> {
    if (context.ddtDocumentId) {
      await this.updateDdtDocumentStatus(context.ddtDocumentId, "ERROR", message);
    }
    if (context.measureReportDocumentId) {
      await this.updateMeasureReportDocumentStatus(context.measureReportDocumentId, "ERROR", message);
    }
  }

  private async updateDdtDocumentStatus(
    ddtDocumentId: string,
    status: "OCR_PROCESSING" | "AI_PROCESSING" | "READY" | "ERROR",
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

  private async updateMeasureReportDocumentStatus(
    measureReportDocumentId: string,
    status: "AI_PROCESSING" | "READY" | "ERROR",
    lastError?: string | null,
  ): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.measureReportDocument.update({
      where: {
        id: measureReportDocumentId,
      },
      data: {
        status,
        last_error: lastError ?? null,
      },
    });
  }

  private async findDocumentIdFromDdt(ddtDocumentId: string | null): Promise<string | null> {
    if (!ddtDocumentId) {
      return null;
    }

    const prisma = PrismaClientManager.getClient();
    const row = await prisma.ddtDocument.findFirst({
      where: {
        id: ddtDocumentId,
      },
      select: {
        document_id: true,
      },
    });

    return row?.document_id ?? null;
  }

  private evaluateCondition(payload: ConditionPayload | null, context: StepExecutionContext): boolean {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return true;
    }

    if ("all" in payload && Array.isArray(payload.all)) {
      return payload.all.every((item) => this.evaluateCondition(item as ConditionPayload, context));
    }
    if ("any" in payload && Array.isArray(payload.any)) {
      return payload.any.some((item) => this.evaluateCondition(item as ConditionPayload, context));
    }

    const op = typeof payload.op === "string" ? payload.op : null;
    const path = typeof payload.path === "string" ? payload.path : null;
    if (!op || !path) {
      return true;
    }

    const left = this.readPath(
      {
        context,
        outputs: Object.fromEntries(context.nodeOutputs.entries()),
      },
      path,
    );

    if (op === "exists") {
      return left !== null && left !== undefined;
    }
    if (op === "truthy") {
      return Boolean(left);
    }
    if (op === "equals") {
      return left === payload.value;
    }
    if (op === "not_equals") {
      return left !== payload.value;
    }

    return true;
  }

  private readPath(source: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".").filter(Boolean);
    let current: unknown = source;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private findNodeOutput(context: StepExecutionContext, key: string): unknown {
    if (context.nodeOutputs.has(key)) {
      return context.nodeOutputs.get(key);
    }
    return null;
  }

  private findLatestNodeOutput(context: StepExecutionContext): unknown {
    const values = Array.from(context.nodeOutputs.values());
    if (values.length === 0) {
      return {};
    }

    const latest = values[values.length - 1];
    const latestRecord = this.toRecord(latest);
    if (latestRecord.output && typeof latestRecord.output === "object" && !Array.isArray(latestRecord.output)) {
      return latestRecord.output;
    }
    return latest;
  }

  private findIncomingNodeOutputs(context: StepExecutionContext, nodeKey: string): IncomingNodeOutputs {
    const sourceKeys = context.incomingNodeKeys.get(nodeKey) ?? [];
    const byNodeKey: Record<string, Record<string, unknown>> = {};
    const items: Array<Record<string, unknown>> = [];

    for (const sourceKey of sourceKeys) {
      const output = this.normalizeNodeOutput(context.nodeOutputs.get(sourceKey));
      byNodeKey[sourceKey] = output;
      items.push(output);
    }

    return { byNodeKey, items };
  }

  private normalizeNodeOutput(value: unknown): Record<string, unknown> {
    const record = this.toRecord(value);
    if (record.output && typeof record.output === "object" && !Array.isArray(record.output)) {
      return record.output as Record<string, unknown>;
    }
    return record;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private firstString(...values: unknown[]): string {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  }

  private resolveKnowledgeMode(inputPayloadRaw: unknown, workflowConfigurationRaw: unknown): KnowledgeMode {
    const inputPayload = this.toRecord(inputPayloadRaw);
    const workflowConfiguration = this.toRecord(workflowConfigurationRaw);
    const inputContextPolicy = this.toRecord(inputPayload.contextPolicy);
    const workflowContextPolicy = this.toRecord(workflowConfiguration.contextPolicy);

    return normalizeKnowledgeMode(
      inputPayload.knowledgeMode
        ?? inputPayload.knowledge_mode
        ?? inputContextPolicy.knowledgeMode
        ?? inputContextPolicy.knowledge_mode
        ?? workflowConfiguration.knowledgeMode
        ?? workflowConfiguration.knowledge_mode
        ?? workflowContextPolicy.knowledgeMode
        ?? workflowContextPolicy.knowledge_mode,
      DEFAULT_KNOWLEDGE_MODE,
    );
  }

  private firstValue(...values: unknown[]): unknown {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (value && typeof value === "object") {
        return value;
      }
    }
    return "";
  }

  private resolveMailAttachments(
    nodeConfig: Record<string, unknown>,
    inputPayload: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    incomingOutputs: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const configured = this.firstArray(nodeConfig.attachments, inputPayload.attachments);
    if (configured.length > 0) {
      return configured;
    }

    const documentBase64 = this.firstString(
      previousOutput.document_base64,
      previousOutput.docx_base64,
      ...this.pickIncomingStrings(incomingOutputs, ["document_base64", "docx_base64"]),
    );
    if (!documentBase64) {
      return [];
    }

    return [{
      file_name: this.firstString(
        previousOutput.file_name,
        ...this.pickIncomingStrings(incomingOutputs, ["file_name"]),
      ) || "documento.docx",
      content_base64: documentBase64,
    }];
  }

  private firstArray(...values: unknown[]): Array<Record<string, unknown>> {
    for (const value of values) {
      if (!Array.isArray(value)) {
        continue;
      }
      return value.filter((item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
      );
    }
    return [];
  }

  private firstStringArray(...values: unknown[]): string[] {
    for (const value of values) {
      if (Array.isArray(value)) {
        const items = value
          .map((item) => typeof item === "string" ? item.trim() : "")
          .filter((item) => item.length > 0);
        if (items.length > 0) {
          return items;
        }
      }
      if (typeof value === "string" && value.trim()) {
        const items = value
          .split(/[\n,;]+/)
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        if (items.length > 0) {
          return items;
        }
      }
    }
    return [];
  }

  private pickIncomingStrings(outputs: Array<Record<string, unknown>>, keys: string[]): string[] {
    return this.pickIncomingValues(outputs, keys).filter((value): value is string =>
      typeof value === "string" && value.trim().length > 0,
    );
  }

  private pickIncomingValues(outputs: Array<Record<string, unknown>>, keys: string[]): unknown[] {
    const values: unknown[] = [];
    for (const output of outputs) {
      for (const key of keys) {
        values.push(output[key]);
      }
    }
    return values;
  }

  private unwrapPythonOutput(envelope: Record<string, unknown> | null): Record<string, unknown> {
    if (!envelope || typeof envelope !== "object") {
      return {};
    }
    const output = envelope.output;
    if (!output || typeof output !== "object") {
      return {};
    }
    return output as Record<string, unknown>;
  }

  private toFailureStatus(required: boolean): WorkflowStepStatus {
    return required ? "FAILED" : "SKIPPED";
  }

  private buildQueueJobId(runId: string): string {
    return `workflow:${runId}`;
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    if (value === undefined || value === null) {
      return {};
    }
    return value as Prisma.InputJsonValue;
  }

  private async notifyRunStatus(
    context: StepExecutionContext,
    status: "completed" | "failed",
    error?: string,
  ): Promise<void> {
    if (!this.notificationService) {
      return;
    }

    const moduleKey = context.moduleKey ?? ModuleKey.WORKFLOW_MANAGEMENT;
    const notification = this.composeWorkflowNotification(context, status, error);

    try {
      await this.notificationService.createInfo({
        workspaceId: context.workspaceId,
        userId: null,
        moduleKey,
        title: notification.title,
        message: notification.message,
      });
    } catch (notifyError) {
      console.error("[WorkflowRunExecutorService] Unable to notify workflow status", {
        runId: context.runId,
        status,
        notifyError,
      });
    }
  }

  private composeWorkflowNotification(
    context: StepExecutionContext,
    status: "completed" | "failed",
    error?: string,
  ): { title: string; message: string } {
    if (context.moduleKey === ModuleKey.DDT_PROCESSING) {
      const documentName = context.ddtSource?.fileName ?? "document.pdf";
      return status === "completed"
        ? { title: "DDT", message: `Analizzato "${documentName}".` }
        : { title: "DDT", message: `Analisi fallita su "${documentName}": ${error ?? "errore sconosciuto"}` };
    }

    if (context.moduleKey === ModuleKey.MEASURE_REPORT) {
      const documentName = context.measureReportSource?.fileName ?? "document.pdf";
      return status === "completed"
        ? { title: "Measure Report", message: `Analizzato "${documentName}".` }
        : { title: "Measure Report", message: `Analisi fallita su "${documentName}": ${error ?? "errore sconosciuto"}` };
    }

    if (context.projectName) {
      const versionLabel = context.projectVersionLabel ? ` ${context.projectVersionLabel.toUpperCase()}` : "";
      if (status === "completed") {
        return {
          title: context.projectName,
          message: `Workflow${versionLabel} completato.`,
        };
      }

      return {
        title: context.projectName,
        message: `Workflow${versionLabel} fallito: ${error ?? "errore sconosciuto"}`,
      };
    }

    return status === "completed"
      ? { title: "Workflow", message: "Esecuzione completata." }
      : { title: "Workflow", message: `Esecuzione fallita: ${error ?? "errore sconosciuto"}` };
  }
}
