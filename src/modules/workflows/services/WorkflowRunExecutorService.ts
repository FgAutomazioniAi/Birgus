import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { Prisma, WorkflowStepStatus } from "@prisma/client";

import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { WorkflowRuntimeAccessPolicy } from "./WorkflowRuntimeAccessPolicy.js";
import { WorkflowRuleEngine } from "./WorkflowRuleEngine.js";
import { HumanInterventionService } from "./HumanInterventionService.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { GaragePath } from "../../../storage/GaragePath.js";
import { StorageSelector } from "../../../storage/StorageSelector.js";
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
  workflowLabel: string;
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
  incomingFieldBindings: Map<string, Map<string, IncomingFieldBinding[]>>;
  outgoingNodeKeys: Map<string, string[]>;
  workflowNodesByKey: Map<string, WorkflowNodeRow>;
  scheduledTargetNodeKeys: Set<string>;
}

type ConditionPayload = Record<string, unknown>;

class WorkflowDecisionRequiredError extends Error {
  public constructor(public readonly interventionId: string) {
    super("Workflow in attesa di una decisione umana.");
  }
}

interface IncomingNodeOutputs {
  byNodeKey: Record<string, Record<string, unknown>>;
  byTargetHandle: Record<string, Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
}

interface IncomingFieldBinding {
  sourceKey: string;
  selectedOutputKey: string | null;
}

type PublishedOutputKind = "text" | "file" | "image" | "delivery_status" | "data";

interface PublishedNodeOutput {
  key: string;
  label: string;
  kind: PublishedOutputKind;
  value: unknown;
  mimeType?: string | null;
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
  private readonly ruleEngine = new WorkflowRuleEngine();
  private readonly humanInterventionService: HumanInterventionService | null;

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
    humanInterventionService?: HumanInterventionService | null;
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
    this.humanInterventionService = params.humanInterventionService ?? null;
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

  public async resumeAfterDecision(runId: string): Promise<void> {
    if (this.jobQueue) {
      await this.jobQueue.enqueue(new Job<WorkflowRunJobPayload>(
        this.buildQueueJobId(runId),
        QueueWorkflowRunDispatcher.JOB_NAME,
        { runId },
      ));
      return;
    }
    await this.executeRun(runId);
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
    const context = await this.buildContext(runId);
    const existingSteps = await prisma.moduleWorkflowRunStep.findMany({
      where: { workflow_run_id: runId, status: { in: ["SUCCEEDED", "SKIPPED"] } },
      orderBy: { sequence_no: "asc" },
    });
    const completedStepByKey = new Map(existingSteps.map((step) => [step.step_key, step]));
    for (const step of existingSteps) {
      context.nodeOutputs.set(step.step_key, step.output_payload ?? {});
    }
    const evaluateCondition = (payload: unknown) => this.evaluateCondition(payload as ConditionPayload | null, context);
    const includeForOrdering = () => true;
    const orderedNodes = this.orderScheduleNodesAfterDeliveryInputs(
      this.graphPlanner.buildExecutionOrder(run.workflow.nodes, run.workflow.edges, includeForOrdering),
      run.workflow.edges,
      includeForOrdering,
    );
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
    context.incomingNodeKeys = this.graphPlanner.buildIncomingNodeKeyMap(run.workflow.nodes, run.workflow.edges, includeForOrdering);
    context.incomingFieldBindings = this.buildIncomingFieldBindingMap(run.workflow.nodes, run.workflow.edges, includeForOrdering);
    context.outgoingNodeKeys = this.buildOutgoingNodeKeyMap(run.workflow.nodes, run.workflow.edges, includeForOrdering);
    context.workflowNodesByKey = new Map(run.workflow.nodes.map((node) => [node.node_key, node]));
    this.ensureScheduleConnectionsAreSupported(context);
    context.scheduledTargetNodeKeys = this.buildScheduledTargetNodeKeys(run.workflow.nodes, context.outgoingNodeKeys);

    let sequenceNo = existingSteps.reduce((max, step) => Math.max(max, step.sequence_no), 0) + 1;
    try {
      for (const node of orderedNodes) {
        if (completedStepByKey.has(node.node_key)) {
          continue;
        }
        await this.handlePreStepStatus(context, node.node_key);
        if (!this.shouldExecuteNode(node.id, run.workflow.edges, context)) {
          const output = { status: "skipped_by_condition", nodeKey: node.node_key };
          context.nodeOutputs.set(node.node_key, output);
          await prisma.moduleWorkflowRunStep.create({
            data: {
              workspace_id: run.workspace_id,
              workflow_run_id: runId,
              workflow_node_id: node.id,
              sequence_no: sequenceNo,
              step_key: node.node_key,
              status: "SKIPPED",
              started_at: new Date(),
              completed_at: new Date(),
              output_payload: this.toInputJson(output),
            },
          });
          sequenceNo += 1;
          continue;
        }
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
          const rawOutput = context.scheduledTargetNodeKeys.has(node.node_key)
            ? this.buildScheduledTargetSkipOutput(node)
            : await this.executeNode(context, node);
          const output = this.publishNodeOutput(node, rawOutput);
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
          if (error instanceof WorkflowDecisionRequiredError) {
            const output = { status: "waiting_for_decision", interventionId: error.interventionId };
            context.nodeOutputs.set(node.node_key, output);
            await prisma.moduleWorkflowRunStep.update({
              where: { id: step.id },
              data: { status: "WAITING_FOR_DECISION", output_payload: this.toInputJson(output) },
            });
            await prisma.moduleWorkflowRun.update({
              where: { id: runId },
              data: { status: "WAITING_FOR_DECISION", result_payload: this.toInputJson(this.buildRunResultPayload(context)) },
            });
            await this.notifyRunStatus(context, "waiting_for_decision");
            return;
          }
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

          throw error;
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
          result_payload: this.toInputJson(this.buildRunResultPayload(context)),
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
          result_payload: this.toInputJson(this.buildRunResultPayload(context)),
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
      workflowLabel: row.workflow.label,
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
      incomingFieldBindings: new Map<string, Map<string, IncomingFieldBinding[]>>(),
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

  private buildIncomingFieldBindingMap(
    nodes: WorkflowNodeRow[],
    edges: Array<{
      source_node_id: string;
      target_node_id: string;
      target_handle: string | null;
      condition_payload: Prisma.JsonValue | null;
      is_enabled: boolean;
    }>,
    evaluateCondition: (payload: unknown) => boolean,
  ): Map<string, Map<string, IncomingFieldBinding[]>> {
    const keyById = new Map(nodes.map((node) => [node.id, node.node_key]));
    const incoming = new Map<string, Map<string, IncomingFieldBinding[]>>();
    for (const edge of edges) {
      if (!edge.is_enabled || !evaluateCondition(edge.condition_payload)) continue;
      const sourceKey = keyById.get(edge.source_node_id);
      const targetKey = keyById.get(edge.target_node_id);
      if (!sourceKey || !targetKey || !edge.target_handle?.startsWith("field:")) continue;
      const field = edge.target_handle.slice("field:".length);
      if (!field) continue;
      const byField = incoming.get(targetKey) ?? new Map<string, IncomingFieldBinding[]>();
      const bindings = byField.get(field) ?? [];
      const condition = this.toRecord(edge.condition_payload);
      const selectedOutputKey = this.firstString(condition.selected_output_key, condition.selectedOutputKey) || null;
      bindings.push({ sourceKey, selectedOutputKey });
      byField.set(field, bindings);
      incoming.set(targetKey, byField);
    }
    return incoming;
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

  private orderScheduleNodesAfterDeliveryInputs(
    nodes: WorkflowNodeRow[],
    edges: Array<{
      source_node_id: string;
      target_node_id: string;
      condition_payload: Prisma.JsonValue | null;
      is_enabled: boolean;
    }>,
    evaluateCondition: (payload: unknown) => boolean,
  ): WorkflowNodeRow[] {
    const ordered = [...nodes];
    const byId = new Map(nodes.map((node) => [node.id, node]));
    for (const schedule of nodes) {
      if (!this.isScheduleHandler(schedule.module_tool?.handler_key ?? null)) continue;
      const deliveryTargetIds = edges
        .filter((edge) => edge.is_enabled && evaluateCondition(edge.condition_payload) && edge.source_node_id === schedule.id)
        .map((edge) => edge.target_node_id)
        .filter((targetId) => this.deliveryChannelFromHandler(byId.get(targetId)?.module_tool?.handler_key ?? null) !== null);
      const inputSourceIds = edges
        .filter((edge) => edge.is_enabled && evaluateCondition(edge.condition_payload) && deliveryTargetIds.includes(edge.target_node_id) && edge.source_node_id !== schedule.id)
        .map((edge) => edge.source_node_id);
      const latestInputIndex = Math.max(-1, ...inputSourceIds.map((sourceId) => ordered.findIndex((node) => node.id === sourceId)));
      const scheduleIndex = ordered.findIndex((node) => node.id === schedule.id);
      if (latestInputIndex <= scheduleIndex) continue;
      const [scheduledNode] = ordered.splice(scheduleIndex, 1);
      ordered.splice(latestInputIndex, 0, scheduledNode);
    }
    return ordered;
  }

  private ensureScheduleConnectionsAreSupported(context: StepExecutionContext): void {
    for (const node of context.workflowNodesByKey.values()) {
      if (!this.isScheduleHandler(node.module_tool?.handler_key ?? null)) {
        continue;
      }
      const invalidTarget = (context.outgoingNodeKeys.get(node.node_key) ?? [])
        .map((key) => context.workflowNodesByKey.get(key))
        .find((target) => !this.deliveryChannelFromHandler(target?.module_tool?.handler_key ?? null));
      if (invalidTarget) {
        throw new Error(`Il nodo Pianifica puo' collegarsi solo a nodi di Resoconto: ${invalidTarget.node_key}.`);
      }
    }
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

    const nodeConfig = this.toRecord(node.configuration);
    const prompt = this.resolveNodePrompt(nodeConfig, node.module_agent?.active_prompt, node.module_agent?.original_prompt);
    if (!prompt) {
      throw new Error(`Prompt agente mancante per il nodo ${node.node_key}.`);
    }

    const previousOutput = this.toRecord(this.findLatestNodeOutput(context));
    const incomingOutputs = this.findIncomingNodeOutputs(context, node.node_key);
    const fieldInput = this.toRecord(incomingOutputs.byTargetHandle.input_text);
    const inputPayload = context.inputPayload ?? {};
    const inputText = this.firstString(
      fieldInput.input_text,
      fieldInput.inputText,
      fieldInput.promptText,
      fieldInput.text,
      fieldInput.reply,
      fieldInput.raw_output,
      fieldInput.extracted_text,
      nodeConfig.input_text,
      nodeConfig.inputText,
      nodeConfig.promptText,
      nodeConfig.text,
      inputPayload.input_text,
      inputPayload.text,
      previousOutput.input_text,
      previousOutput.inputText,
      previousOutput.promptText,
      previousOutput.extracted_text,
      previousOutput.reply,
      previousOutput.text,
      previousOutput.raw_output,
      ...this.pickIncomingStrings(incomingOutputs.items, ["input_text", "inputText", "promptText", "extracted_text", "reply", "text", "raw_output"]),
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
      const result = await this.pythonModulesClient.execute(moduleName, action, input);
      if (moduleName === "docx_engine" && action === "generate_document" && this.toRecord(node.configuration).save_to_archive === true) {
        const archived = await this.archiveGeneratedDocument(context, result);
        return { ...result, output: { ...this.unwrapPythonOutput(result), ...archived } };
      }
      return result;
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
        throw new Error("Sorgente file mancante per Text Recognition.");
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
    const prompt = this.resolveNodePrompt(nodeConfig, this.defaultPromptForLangchainAction(action));

    if (action === "chat") {
      return {
        ...merged,
        ...(prompt ? { instructions: prompt } : {}),
        input_text: this.firstString(
          nodeConfig.input_text,
          inputPayload.input_text,
          previousOutput.input_text,
          previousOutput.inputText,
          previousOutput.promptText,
          previousOutput.reply,
          previousOutput.extracted_text,
          previousOutput.text,
          previousOutput.raw_output,
          ...this.pickIncomingStrings(incomingOutputs.items, ["input_text", "inputText", "promptText", "reply", "extracted_text", "text", "raw_output"]),
        ),
      };
    }

    if (action === "structure_text") {
      return {
        ...merged,
        ...(prompt ? { instructions: prompt } : {}),
        extracted_text: this.firstString(
          nodeConfig.extracted_text,
          inputPayload.extracted_text,
          previousOutput.input_text,
          previousOutput.inputText,
          previousOutput.promptText,
          previousOutput.extracted_text,
          previousOutput.reply,
          previousOutput.text,
          previousOutput.raw_output,
          ...this.pickIncomingStrings(incomingOutputs.items, ["input_text", "inputText", "promptText", "extracted_text", "reply", "text", "raw_output"]),
        ),
      };
    }

    if (action === "compose_email") {
      return {
        ...merged,
        ...(prompt ? { extra_instructions: prompt, instructions: prompt } : {}),
        context: this.firstString(
          nodeConfig.context,
          inputPayload.context,
          previousOutput.input_text,
          previousOutput.inputText,
          previousOutput.promptText,
          previousOutput.reply,
          previousOutput.raw_output,
          previousOutput.text,
          previousOutput.extracted_text,
          ...this.pickIncomingStrings(incomingOutputs.items, ["input_text", "inputText", "promptText", "reply", "raw_output", "text", "extracted_text"]),
        ),
      };
    }

    if (action === "format_text") {
      const contentField = this.toRecord(incomingOutputs.byTargetHandle.content);
      const templateField = this.toRecord(incomingOutputs.byTargetHandle.template);
      return {
        ...merged,
        ...(prompt ? { instructions: prompt } : {}),
        content: this.firstString(
          contentField.content,
          contentField.formatted_text,
          contentField.text,
          contentField.reply,
          contentField.raw_output,
          nodeConfig.content,
          inputPayload.content,
          ...this.pickIncomingStrings(incomingOutputs.items, ["content", "formatted_text", "text", "reply", "raw_output", "extracted_text"]),
        ),
        template: this.firstString(
          templateField.template,
          templateField.text,
          templateField.content,
          templateField.formatted_text,
          templateField.raw_output,
          nodeConfig.template,
          inputPayload.template,
        ),
      };
    }

    return merged;
  }

  private resolveNodePrompt(
    nodeConfig: Record<string, unknown>,
    fallbackActivePrompt?: string | null,
    fallbackOriginalPrompt?: string | null,
  ): string {
    return this.firstString(
      nodeConfig.currentPrompt,
      nodeConfig.current_prompt,
      nodeConfig.instructions,
      nodeConfig.prompt,
      nodeConfig.extra_instructions,
      nodeConfig.defaultPrompt,
      nodeConfig.default_prompt,
      fallbackActivePrompt,
      fallbackOriginalPrompt,
    );
  }

  private defaultPromptForLangchainAction(action: string): string {
    if (action === "structure_text") {
      return "Estrai dal testo ricevuto solo i dati richiesti, mantenendo una struttura chiara e verificabile.";
    }
    if (action === "compose_email") {
      return "Componi una bozza email professionale, sintetica e coerente con il contesto ricevuto.";
    }
    if (action === "format_text") {
      return "Applica il template al contenuto senza omettere dati o aggiungere informazioni non presenti.";
    }
    if (action === "chat") {
      return "Rispondi in modo chiaro, operativo e coerente con l'input ricevuto dal workflow.";
    }
    return "";
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
    if (typeof config.maxOutputTokens === "number" && Number.isFinite(config.maxOutputTokens) && config.maxOutputTokens > 0) {
      override.max_output_tokens = Math.trunc(config.maxOutputTokens);
    }
    if (typeof config.topP === "number" && Number.isFinite(config.topP)) {
      override.top_p = config.topP;
    }
    if (typeof config.topK === "number" && Number.isFinite(config.topK)) {
      override.top_k = Math.trunc(config.topK);
    }
    if (typeof config.minP === "number" && Number.isFinite(config.minP)) {
      override.min_p = config.minP;
    }
    if (typeof config.repetitionPenalty === "number" && Number.isFinite(config.repetitionPenalty)) {
      override.repetition_penalty = config.repetitionPenalty;
    }
    if (typeof config.seed === "number" && Number.isFinite(config.seed)) {
      override.seed = Math.trunc(config.seed);
    }
    if (typeof config.contextTokenLimit === "number" && Number.isFinite(config.contextTokenLimit) && config.contextTokenLimit > 0) {
      override.context_token_limit = Math.trunc(config.contextTokenLimit);
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
    const contentField = this.toRecord(incomingOutputs.byTargetHandle.content);
    const fileNameField = this.toRecord(incomingOutputs.byTargetHandle.file_name);
    return {
      ...nodeConfig,
      ...inputPayload,
      previous_output: previousOutput,
      incoming_outputs: incomingOutputs.byNodeKey,
      content: this.firstValue(
        contentField.input_text,
        contentField.inputText,
        contentField.promptText,
        contentField.reply,
        contentField.text,
        contentField.raw_output,
        contentField.extracted_text,
        contentField.structured_data,
        nodeConfig.content,
        inputPayload.content,
        previousOutput.input_text,
        previousOutput.inputText,
        previousOutput.promptText,
        previousOutput.reply,
        previousOutput.text,
        previousOutput.raw_output,
        previousOutput.extracted_text,
        previousOutput.structured_data,
        ...this.pickIncomingValues(incomingOutputs.items, ["input_text", "inputText", "promptText", "reply", "text", "raw_output", "extracted_text", "structured_data"]),
      ),
      title: this.firstString(nodeConfig.title, inputPayload.title),
      format: this.firstString(nodeConfig.format, inputPayload.format) || "docx",
      file_name: this.firstString(
        fileNameField.file_name,
        fileNameField.fileName,
        fileNameField.input_text,
        fileNameField.inputText,
        fileNameField.promptText,
        fileNameField.reply,
        fileNameField.text,
        fileNameField.raw_output,
        nodeConfig.file_name,
        nodeConfig.filename,
        inputPayload.file_name,
        inputPayload.filename,
        previousOutput.file_name,
      ),
    };
  }

  private async archiveGeneratedDocument(
    context: StepExecutionContext,
    result: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const output = this.unwrapPythonOutput(result);
    const base64 = this.firstString(output.document_base64);
    const fileName = this.firstString(output.file_name) || "documento";
    const contentType = this.firstString(output.content_type) || "application/octet-stream";
    if (!base64) {
      throw new Error("Il generatore non ha prodotto un file archiviabile.");
    }

    const bytes = Buffer.from(base64, "base64");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const extension = this.fileExtension(fileName);
    const storage = StorageSelector.create();
    const objectKey = GaragePath.buildObjectKey(
      storage.storagePrefix(), context.workspaceId, "workflows", context.workflowKey,
      "generated-document", checksum, fileName,
    );
    const stored = await storage.putObject({
      objectKey,
      bytes,
      contentType,
      metadata: { workspaceid: context.workspaceId, workflowkey: context.workflowKey, runid: context.runId, sha256: checksum },
    });

    const prisma = PrismaClientManager.getClient();
    const [fileType, fileStatus, node, moduleRecord] = await Promise.all([
      prisma.fileType.upsert({
        where: { key: extension },
        update: { mime_type: contentType },
        create: { key: extension, mime_type: contentType },
      }),
      prisma.fileStatus.upsert({
        where: { key: "uploaded" },
        update: {},
        create: { key: "uploaded" },
      }),
      prisma.node.upsert({
        where: { workspace_id_path_cache: { workspace_id: context.workspaceId, path_cache: "/documents/workflows/generated" } },
        update: { deleted_at: null },
        create: { workspace_id: context.workspaceId, name: "generated", path_cache: "/documents/workflows/generated", depth: 3 },
      }),
      prisma.module.findUnique({ where: { key: "workflow_management" }, select: { id: true } }),
    ]);
    const document = await prisma.document.create({
      data: {
        workspace_id: context.workspaceId,
        node_id: node.id,
        file_type_id: fileType.id,
        file_status_id: fileStatus.id,
        module_id: moduleRecord?.id ?? null,
        scope: "WORKSPACE",
        domain_entity_type: "WorkflowRun",
        domain_entity_id: context.runId,
        filename: fileName,
        size_bytes: BigInt(bytes.length),
        storage_path: GaragePath.toStoragePath(stored.bucket, stored.objectKey),
        checksum_sha256: checksum,
        uploaded_by_user_id: context.userId,
      },
      select: { id: true, storage_path: true },
    });
    const knowledge = await this.documentIntelligenceService.refreshDocumentKnowledge(context.workspaceId, document.id);
    return { archived: true, document_id: document.id, storage_path: document.storage_path, knowledge_document_id: knowledge.id };
  }

  private fileExtension(fileName: string): string {
    const extension = fileName.split(".").pop()?.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    return extension || "bin";
  }

  private async buildGenericMailInput(
    context: StepExecutionContext,
    nodeConfig: Record<string, unknown>,
    inputPayload: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    incomingOutputs: IncomingNodeOutputs,
  ): Promise<Record<string, unknown>> {
    const textField = this.toRecord(incomingOutputs.byTargetHandle.text);
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
        textField.input_text,
        textField.inputText,
        textField.promptText,
        textField.text,
        textField.reply,
        textField.raw_output,
        nodeConfig.text,
        inputPayload.text,
        previousOutput.input_text,
        previousOutput.inputText,
        previousOutput.promptText,
        previousOutput.text,
        previousOutput.reply,
        previousOutput.raw_output,
        ...this.pickIncomingStrings(incomingOutputs.items, ["input_text", "inputText", "promptText", "text", "reply", "raw_output"]),
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
    const textField = this.toRecord(incomingOutputs.byTargetHandle.text);
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
        textField.input_text,
        textField.inputText,
        textField.promptText,
        textField.text,
        textField.reply,
        textField.raw_output,
        nodeConfig.text,
        nodeConfig.message,
        inputPayload.text,
        inputPayload.message,
        previousOutput.input_text,
        previousOutput.inputText,
        previousOutput.promptText,
        previousOutput.text,
        previousOutput.reply,
        previousOutput.raw_output,
        ...this.pickIncomingStrings(incomingOutputs.items, ["input_text", "inputText", "promptText", "text", "reply", "raw_output"]),
      ),
    };
  }

  private buildWhatsappInput(
    nodeConfig: Record<string, unknown>,
    inputPayload: Record<string, unknown>,
    previousOutput: Record<string, unknown>,
    incomingOutputs: IncomingNodeOutputs,
  ): Record<string, unknown> {
    const textField = this.toRecord(incomingOutputs.byTargetHandle.text);
    return {
      ...nodeConfig,
      ...inputPayload,
      previous_output: previousOutput,
      incoming_outputs: incomingOutputs.byNodeKey,
      to: this.firstString(nodeConfig.to, nodeConfig.phone, inputPayload.to, inputPayload.phone),
      text: this.firstString(
        textField.input_text,
        textField.inputText,
        textField.promptText,
        textField.text,
        textField.reply,
        textField.raw_output,
        nodeConfig.text,
        nodeConfig.message,
        inputPayload.text,
        inputPayload.message,
        previousOutput.input_text,
        previousOutput.inputText,
        previousOutput.promptText,
        previousOutput.text,
        previousOutput.reply,
        previousOutput.raw_output,
        ...this.pickIncomingStrings(incomingOutputs.items, ["input_text", "inputText", "promptText", "text", "reply", "raw_output"]),
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

    const runAt = this.parseScheduleDateTime(runAtText);
    if (!runAt) {
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
      const targetIncomingOutputs = this.findIncomingNodeOutputs(context, target.node_key);
      const delivery = await this.buildScheduledDeliveryPayload(
        context,
        channel,
        targetConfig,
        inputPayload,
        previousOutput,
        targetIncomingOutputs,
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

  private parseScheduleDateTime(value: string): Date | null {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0"] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const localAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (
      localAsUtc.getUTCFullYear() !== year
      || localAsUtc.getUTCMonth() !== month - 1
      || localAsUtc.getUTCDate() !== day
      || localAsUtc.getUTCHours() !== hour
      || localAsUtc.getUTCMinutes() !== minute
      || localAsUtc.getUTCSeconds() !== second
    ) {
      return null;
    }

    const timeZone = process.env.WORKFLOW_SCHEDULE_TIME_ZONE?.trim() || "Europe/Rome";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(localAsUtc);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? "");
    const offsetMs = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second")) - localAsUtc.getTime();
    return new Date(localAsUtc.getTime() - offsetMs);
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
    if (nodeConfig.scheduleRepeatEnabled === false || nodeConfig.repeat_enabled === false) {
      return null;
    }
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

    if (handlerKey === "workflow_logic.verify_and_route") {
      return this.executeVerifyAndRouteTool(context, node);
    }

    if (handlerKey === "workflow_text.format_template") {
      return this.executeTemplateFormattingTool(context, node);
    }

    if (handlerKey === "workflow_attention.create_human_review") {
      return this.executeHumanReviewTool(context, node);
    }

    if (handlerKey === "workflow_attention.request_decision") {
      return this.executeDecisionRequestTool(context, node);
    }

    throw new Error(`Backend handler non supportato: ${handlerKey}`);
  }

  private executeVerifyAndRouteTool(context: StepExecutionContext, node: WorkflowNodeRow): Record<string, unknown> {
    const configuration = this.toRecord(node.configuration);
    const incomingOutputs = this.findIncomingNodeOutputs(context, node.node_key);
    const configuredRules = Array.isArray(configuration.rules) ? configuration.rules : [];
    const checkedFields = configuredRules.map((rawRule, index) => {
      const rule = this.toRecord(rawRule);
      return {
        key: `field_${index + 1}`,
        label: this.firstString(rule.label, rule.name) || `Valore ${index + 1}`,
        value: this.resolveVerificationValue(this.toRecord(incomingOutputs.byTargetHandle[`rule_${index}`])),
      };
    });
    const variables = Object.fromEntries(checkedFields.map((field, index) => [String(index + 1), field.value]));
    const source = {
      input: context.inputPayload ?? {},
      previous: this.toRecord(this.findLatestNodeOutput(context)),
      incoming: incomingOutputs.byNodeKey,
      fields: incomingOutputs.byTargetHandle,
      var: variables,
      context: {
        clientEmail: context.clientEmail,
        clientName: context.clientName,
        projectId: context.projectId,
        projectName: context.projectName,
        documentId: context.documentId,
      },
    };
    const rules = configuredRules.map((rule, index) => ({ ...this.toRecord(rule), path: `var.${index + 1}` }));
    const result = this.ruleEngine.evaluate(rules, source);
    return {
      status: result.valid ? "valid" : "attention_required",
      valid: result.valid,
      violations: result.violations,
      checked_fields: checkedFields,
      published_outputs: checkedFields.map((field) => ({
        key: field.key,
        label: field.label,
        kind: "data",
        value: field.value,
      })),
    };
  }

  private resolveVerificationValue(output: Record<string, unknown>): unknown {
    const selected = this.toRecord(output.selected_output);
    if ("value" in selected) {
      return selected.value;
    }

    const published = Array.isArray(output.published_outputs) ? output.published_outputs : [];
    for (const item of published) {
      const candidate = this.toRecord(item);
      if ("value" in candidate) {
        return candidate.value;
      }
    }

    for (const key of ["text", "formatted_text", "reply", "extracted_text", "summary", "value", "structured_data"]) {
      if (output[key] !== undefined && output[key] !== null) {
        return output[key];
      }
    }
    return output;
  }

  private executeTemplateFormattingTool(context: StepExecutionContext, node: WorkflowNodeRow): Record<string, unknown> {
    const configuration = this.toRecord(node.configuration);
    const incomingOutputs = this.findIncomingNodeOutputs(context, node.node_key);
    const contentField = this.toRecord(incomingOutputs.byTargetHandle.content);
    const templateField = this.toRecord(incomingOutputs.byTargetHandle.template);
    const source = {
      input: context.inputPayload ?? {},
      previous: this.toRecord(this.findLatestNodeOutput(context)),
      incoming: incomingOutputs.byNodeKey,
      fields: incomingOutputs.byTargetHandle,
      content: this.firstString(contentField.content, contentField.formatted_text, contentField.text, contentField.reply, contentField.raw_output, configuration.content),
    };
    const template = this.firstString(templateField.template, templateField.text, templateField.content, templateField.formatted_text, templateField.raw_output, configuration.template);
    if (!source.content) {
      throw new Error("Contenuto mancante per Applica template.");
    }
    if (!template) {
      throw new Error("Template documento mancante per Applica template.");
    }

    const missing: string[] = [];
    const formattedText = template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, rawPath: string) => {
      const value = this.readPath(source, rawPath.trim());
      if (value === undefined || value === null) {
        missing.push(rawPath.trim());
        return "";
      }
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
    });
    if (missing.length > 0) {
      throw new Error(`Valori template mancanti: ${Array.from(new Set(missing)).join(", ")}.`);
    }
    return { formatted_text: formattedText, text: formattedText, template, mode: "deterministic" };
  }

  private async executeHumanReviewTool(context: StepExecutionContext, node: WorkflowNodeRow): Promise<Record<string, unknown>> {
    const configuration = this.toRecord(node.configuration);
    const incoming = this.findIncomingNodeOutputs(context, node.node_key);
    const latest = this.toRecord(this.findLatestNodeOutput(context));
    const title = this.firstString(configuration.title, configuration.review_title) || "Revisione workflow richiesta";
    const message = this.firstString(
      configuration.message,
      configuration.review_message,
      latest.message,
      latest.status === "attention_required" ? "Una verifica del workflow richiede attenzione umana." : "Verifica manuale richiesta dal workflow.",
    );
    const userId = this.firstString(configuration.assignee_user_id, configuration.assigneeUserId) || null;

    if (this.notificationService) {
      await this.notificationService.createInfo({
        workspaceId: context.workspaceId,
        userId,
        moduleKey: context.moduleKey,
        title,
        message,
      });
    }

    return {
      status: "attention_created",
      title,
      message,
      assigneeUserId: userId,
      input: incoming.byNodeKey,
    };
  }

  private async executeDecisionRequestTool(context: StepExecutionContext, node: WorkflowNodeRow): Promise<never> {
    if (!this.humanInterventionService) {
      throw new Error("Servizio interventi umani non disponibile.");
    }
    const configuration = this.toRecord(node.configuration);
    const latest = this.toRecord(this.findLatestNodeOutput(context));
    const request = await this.humanInterventionService.createDecisionRequest({
      workspaceId: context.workspaceId,
      workflowRunId: context.runId,
      workflowNodeId: node.id,
      createdByUserId: context.userId,
      assignedUserId: this.firstString(configuration.assignee_user_id, configuration.assigneeUserId) || null,
      title: this.firstString(configuration.title, configuration.decision_title) || "Decisione richiesta",
      message: this.firstString(configuration.message, configuration.decision_message, latest.message) || "Il workflow richiede una decisione umana per proseguire.",
      priority: this.firstString(configuration.priority) || "normal",
      input: { latest, incoming: this.findIncomingNodeOutputs(context, node.node_key).byNodeKey },
    });
    throw new WorkflowDecisionRequiredError(request.id);
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
      nodeConfig.currentPrompt,
      nodeConfig.current_prompt,
      nodeConfig.instructions,
      nodeConfig.prompt,
      nodeConfig.question,
      inputPayload.prompt,
      inputPayload.question,
      previousOutput.input_text,
      previousOutput.inputText,
      previousOutput.promptText,
      previousOutput.prompt,
      previousOutput.question,
      previousOutput.text,
      previousOutput.reply,
      ...this.pickIncomingStrings(incomingOutputs.items, ["input_text", "inputText", "promptText", "prompt", "question", "text", "reply"]),
      nodeConfig.defaultPrompt,
      nodeConfig.default_prompt,
      "Analizza i documenti collegati e produci una risposta chiara, citando gli elementi rilevanti.",
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

    const nodeConfig = this.toRecord(node.configuration);
    const requestedKey = this.firstString(nodeConfig.output_key, nodeConfig.outputKey, nodeConfig.selected_output_key);
    const incomingOutputs = this.findIncomingNodeOutputs(context, node.node_key);
    const availableOutputs = this.collectPublishedOutputs(incomingOutputs.items);
    const selectedOutput = availableOutputs.find((item) => item.key === requestedKey) ?? availableOutputs[0] ?? null;

    return {
      nodeKey: node.node_key,
      outputKind: node.output_kind,
      selected_output: selectedOutput,
      published_outputs: selectedOutput ? [selectedOutput] : [],
      outcome: selectedOutput?.value ?? null,
    };
  }

  private publishNodeOutput(node: WorkflowNodeRow, value: unknown): Record<string, unknown> {
    const output = this.toRecord(value);
    const published = this.collectPublishedOutputs([output]);
    if (published.length > 0) {
      return { ...output, published_outputs: published };
    }

    return { ...output, published_outputs: this.inferPublishedOutputs(node, output, value) };
  }

  private inferPublishedOutputs(
    node: Pick<WorkflowNodeRow, "node_key" | "node_kind" | "output_kind">,
    output: Record<string, unknown>,
    rawValue: unknown,
  ): PublishedNodeOutput[] {
    if (typeof rawValue === "string" && rawValue.trim()) {
      return [{ key: "text", label: this.textOutputLabel(node), kind: "text", value: rawValue.trim() }];
    }
    if (Array.isArray(rawValue)) {
      return [{ key: "data", label: "Dati prodotti", kind: "data", value: rawValue }];
    }

    const unwrapped = this.unwrapPythonOutput(output);
    const imageUrl = this.firstString(output.image_url, output.imageUrl, unwrapped.image_url, unwrapped.imageUrl);
    if (imageUrl) {
      return [{ key: "image", label: "Immagine prodotta", kind: "image", value: imageUrl }];
    }

    const structuredData = output.structured_data ?? unwrapped.structured_data;
    if (structuredData && typeof structuredData === "object") {
      const rawText = this.firstString(output.raw_output, unwrapped.raw_output);
      return [
        { key: "structured_data", label: "Dati estratti", kind: "data", value: structuredData },
        ...(rawText ? [{ key: "text", label: "Testo elaborato", kind: "text" as const, value: rawText }] : []),
      ];
    }

    const text = this.firstString(
      output.reply, output.text, output.raw_output, output.extracted_text, output.summary,
      unwrapped.reply, unwrapped.text, unwrapped.raw_output, unwrapped.extracted_text, unwrapped.summary,
    );
    const subject = this.firstString(output.subject, unwrapped.subject);
    if (subject && text) {
      return [
        { key: "subject", label: "Oggetto email", kind: "text", value: subject },
        { key: "text", label: this.textOutputLabel(node), kind: "text", value: text },
      ];
    }
    if (text) {
      return [{ key: "text", label: this.textOutputLabel(node), kind: "text", value: text }];
    }

    const fileName = this.firstString(output.file_name, output.fileName, unwrapped.file_name, unwrapped.fileName);
    const storagePath = this.firstString(output.storage_path, output.storagePath, unwrapped.storage_path, unwrapped.storagePath);
    const encodedDocument = this.firstString(output.document_base64, output.docx_base64, unwrapped.document_base64, unwrapped.docx_base64);
    if (fileName || storagePath || encodedDocument || output.persisted === true && node.output_kind === "quotation_delivery") {
      return [{
        key: "file",
        label: "Documento generato",
        kind: "file",
        value: {
          fileName: fileName ?? (output.docx_base64 || unwrapped.docx_base64 ? "documento.docx" : "Documento generato"),
          storagePath: storagePath ?? null,
          documentId: this.firstString(output.document_id, output.documentId, unwrapped.document_id, unwrapped.documentId) || null,
          sizeBytes: output.size_bytes ?? output.sizeBytes ?? null,
          downloadBase64: encodedDocument ?? null,
        },
        mimeType: this.firstString(output.content_type, output.contentType, unwrapped.content_type, unwrapped.contentType) || null,
      }];
    }

    if (this.isDeliveryOutput(node, output)) {
      const deliveryStatus = this.firstString(output.status, unwrapped.status);
      const normalizedStatus = deliveryStatus.toLowerCase();
      const sent = output.sent === true
        || output.delivered === true
        || output.persisted === true
        || unwrapped.sent === true
        || unwrapped.delivered === true
        || ["sent", "delivered", "completed", "success"].includes(normalizedStatus);
      return [{
        key: "delivery_status",
        label: "Esito invio",
        kind: "delivery_status",
        value: {
          sent,
          status: deliveryStatus || (sent ? "completed" : "not_sent"),
          recipient: this.firstString(output.recipient, output.to, output.chat_id, unwrapped.recipient, unwrapped.to, unwrapped.chat_id) || null,
          message: this.firstString(output.message, output.reason, output.error, unwrapped.message, unwrapped.reason, unwrapped.error) || null,
        },
      }];
    }

    if (rawValue !== null && rawValue !== undefined && Object.keys(output).length > 0) {
      return [{ key: "data", label: "Dati prodotti", kind: "data", value: rawValue }];
    }
    return [];
  }

  private collectPublishedOutputs(items: Array<Record<string, unknown>>): PublishedNodeOutput[] {
    return items.flatMap((item) => {
      const candidates = Array.isArray(item.published_outputs) ? item.published_outputs : [];
      return candidates.flatMap((candidate): PublishedNodeOutput[] => {
        const record = this.toRecord(candidate);
        const key = this.firstString(record.key);
        const label = this.firstString(record.label);
        const kind = this.firstString(record.kind);
        if (!key || !label || !["text", "file", "image", "delivery_status", "data"].includes(kind)) {
          return [];
        }
        return [{ key, label, kind: kind as PublishedOutputKind, value: record.value, mimeType: this.firstString(record.mimeType, record.mime_type) || null }];
      });
    });
  }

  private buildRunResultPayload(context: StepExecutionContext): Record<string, unknown> {
    const finalOutputs = Array.from(context.nodeOutputs.entries()).flatMap(([nodeKey, value]) => {
      const node = context.workflowNodesByKey.get(nodeKey);
      if (node?.node_kind !== "OUTPUT") {
        return [];
      }
      return this.collectPublishedOutputs([this.toRecord(value)]).map((output) => ({ ...output, nodeKey }));
    });
    return { workflowKey: context.workflowKey, final_outputs: finalOutputs, outputs: Object.fromEntries(context.nodeOutputs.entries()) };
  }

  private textOutputLabel(node: Pick<WorkflowNodeRow, "node_key" | "node_kind" | "output_kind">): string {
    if (node.node_kind === "AGENT") return "Risposta IA";
    if (node.node_key.includes("ocr")) return "Testo estratto";
    if (node.node_key.includes("analysis")) return "Analisi";
    return "Testo";
  }

  private isDeliveryOutput(node: Pick<WorkflowNodeRow, "node_key" | "node_kind" | "output_kind">, output: Record<string, unknown>): boolean {
    const unwrapped = this.unwrapPythonOutput(output);
    return node.output_kind?.includes("delivery") === true
      || /mail|telegram|whatsapp|send/i.test(node.node_key)
      || "sent" in output
      || "delivered" in output
      || "sent" in unwrapped
      || "delivered" in unwrapped
      || "status" in unwrapped;
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
    if (!("op" in payload) && !("operator" in payload) && !("all" in payload) && !("any" in payload) && !("not" in payload)) {
      return true;
    }
    const normalize = (value: unknown): unknown => {
      const record = this.toRecord(value);
      if (Array.isArray(record.all) || Array.isArray(record.any)) {
        return {
          ...record,
          ...(Array.isArray(record.all) ? { all: record.all.map(normalize) } : {}),
          ...(Array.isArray(record.any) ? { any: record.any.map(normalize) } : {}),
        };
      }
      if (record.not && typeof record.not === "object") {
        return { ...record, not: normalize(record.not) };
      }
      return {
        ...record,
        operator: typeof record.operator === "string" ? record.operator : record.op,
      };
    };

    return this.ruleEngine.evaluate([normalize(payload)], {
      context,
      outputs: Object.fromEntries(context.nodeOutputs.entries()),
    }).valid;
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

  private shouldExecuteNode(
    nodeId: string,
    edges: Array<{ source_node_id: string; target_node_id: string; source_handle: string | null; is_enabled: boolean; condition_payload: Prisma.JsonValue | null }>,
    context: StepExecutionContext,
  ): boolean {
    const incoming = edges.filter((edge) => edge.target_node_id === nodeId && edge.is_enabled);
    return incoming.length === 0 || incoming.some((edge) => this.isIncomingEdgeSatisfied(edge, context));
  }

  private isIncomingEdgeSatisfied(
    edge: { source_node_id: string; source_handle: string | null; condition_payload: Prisma.JsonValue | null },
    context: StepExecutionContext,
  ): boolean {
    if (!this.evaluateCondition(edge.condition_payload as ConditionPayload | null, context)) {
      return false;
    }
    if (edge.source_handle !== "valid" && edge.source_handle !== "invalid") {
      return true;
    }

    const sourceNode = Array.from(context.workflowNodesByKey.values()).find((node) => node.id === edge.source_node_id);
    if (sourceNode?.module_tool?.handler_key !== "workflow_logic.verify_and_route") {
      return true;
    }
    const output = this.normalizeNodeOutput(context.nodeOutputs.get(sourceNode.node_key));
    return edge.source_handle === "valid" ? output.valid === true : output.valid === false;
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
    const byTargetHandle: Record<string, Record<string, unknown>> = {};
    const items: Array<Record<string, unknown>> = [];

    for (const sourceKey of sourceKeys) {
      const output = this.normalizeNodeOutput(context.nodeOutputs.get(sourceKey));
      byNodeKey[sourceKey] = output;
      items.push(output);
    }

    const fields = context.incomingFieldBindings.get(nodeKey);
    for (const [field, bindings] of fields ?? []) {
      const binding = bindings[bindings.length - 1];
      if (binding) {
        const output = this.normalizeNodeOutput(context.nodeOutputs.get(binding.sourceKey));
        byTargetHandle[field] = binding.selectedOutputKey
          ? this.withSelectedPublishedOutput(output, binding.selectedOutputKey)
          : output;
      }
    }

    return { byNodeKey, byTargetHandle, items };
  }

  private normalizeNodeOutput(value: unknown): Record<string, unknown> {
    const record = this.toRecord(value);
    if (record.output && typeof record.output === "object" && !Array.isArray(record.output)) {
      return {
        ...(record.output as Record<string, unknown>),
        published_outputs: record.published_outputs ?? (record.output as Record<string, unknown>).published_outputs,
      };
    }
    return record;
  }

  private withSelectedPublishedOutput(output: Record<string, unknown>, outputKey: string): Record<string, unknown> {
    const selected = this.collectPublishedOutputs([output]).find((item) => item.key === outputKey);
    if (!selected) {
      return output;
    }
    if (typeof selected.value === "string") {
      return { ...output, selected_output: selected, text: selected.value, content: selected.value };
    }
    return { ...output, selected_output: selected };
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
    status: "completed" | "failed" | "waiting_for_decision",
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
    status: "completed" | "failed" | "waiting_for_decision",
    error?: string,
  ): { title: string; message: string } {
    const workflowName = context.workflowLabel.trim() || context.workflowKey || "Workflow";
    if (status === "waiting_for_decision") {
      return { title: workflowName, message: "Esecuzione in attesa di una decisione umana." };
    }
    if (context.moduleKey === ModuleKey.DDT_PROCESSING) {
      const documentName = context.ddtSource?.fileName ?? "document.pdf";
      return status === "completed"
        ? { title: workflowName, message: `DDT analizzato: "${documentName}".` }
        : { title: workflowName, message: `Analisi DDT fallita su "${documentName}": ${error ?? "errore sconosciuto"}` };
    }

    if (context.moduleKey === ModuleKey.MEASURE_REPORT) {
      const documentName = context.measureReportSource?.fileName ?? "document.pdf";
      return status === "completed"
        ? { title: workflowName, message: `Measure Report analizzato: "${documentName}".` }
        : { title: workflowName, message: `Analisi Measure Report fallita su "${documentName}": ${error ?? "errore sconosciuto"}` };
    }

    if (context.projectName) {
      const versionLabel = context.projectVersionLabel ? ` ${context.projectVersionLabel.toUpperCase()}` : "";
      if (status === "completed") {
        return {
          title: workflowName,
          message: `${context.projectName}${versionLabel}: esecuzione completata.`,
        };
      }

      return {
        title: workflowName,
        message: `${context.projectName}${versionLabel}: esecuzione fallita: ${error ?? "errore sconosciuto"}`,
      };
    }

    return status === "completed"
      ? { title: workflowName, message: "Esecuzione completata." }
      : { title: workflowName, message: `Esecuzione fallita: ${error ?? "errore sconosciuto"}` };
  }
}
