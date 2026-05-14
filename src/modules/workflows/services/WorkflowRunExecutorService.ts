import { Buffer } from "node:buffer";

import { Prisma, WorkflowStepStatus } from "@prisma/client";

import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { FileKind } from "../../document-archive/domain/FileKind.js";
import { PutProjectFileCommand } from "../../document-archive/dto/PutProjectFileCommand.js";
import { DocumentArchiveService } from "../../document-archive/services/DocumentArchiveService.js";
import { DocumentIntelligenceService } from "../../document-intelligence/services/DocumentIntelligenceService.js";
import { BackendPythonModulesClient } from "../../document-intelligence/services/BackendPythonModulesClient.js";
import { NotificationService } from "../../notifications/services/NotificationService.js";
import { NextOrchestratorDdtAnalyzer } from "../../ddt-processing/services/NextOrchestratorDdtAnalyzer.js";
import { DdtAnalysisInput } from "../../ddt-processing/repositories/DdtProcessingRepository.js";
import { NextOrchestratorQuotationAnalyzer } from "../../quotation-orchestrator/services/NextOrchestratorQuotationAnalyzer.js";

interface StepExecutionContext {
  workspaceId: string;
  runId: string;
  workflowKey: string;
  moduleKey: string | null;
  projectId: string | null;
  projectVersionLabel: string | null;
  projectVersionId: number | null;
  clientId: string | null;
  clientEmail: string | null;
  clientName: string | null;
  projectName: string | null;
  documentId: string | null;
  ddtDocumentId: string | null;
  quotationSource: {
    documentId: string;
    storagePath: string;
    fileName: string;
  } | null;
  ddtSource: {
    storagePath: string;
    fileName: string;
  } | null;
  inputPayload: Record<string, unknown> | null;
  nodeOutputs: Map<string, unknown>;
}

type ConditionPayload = Record<string, unknown>;

interface WorkflowNodeRow {
  id: string;
  node_key: string;
  node_kind: string;
  is_enabled: boolean;
  is_required: boolean;
  output_kind: string | null;
  module_agent: { key: string; active_prompt: string; original_prompt: string } | null;
  module_tool: { key: string; runtime_kind: string; handler_key: string; configuration: Prisma.JsonValue | null } | null;
}

export class WorkflowRunExecutorService {
  private readonly documentArchiveService: DocumentArchiveService;
  private readonly documentIntelligenceService: DocumentIntelligenceService;
  private readonly quotationAnalyzer: NextOrchestratorQuotationAnalyzer;
  private readonly ddtAnalyzer: NextOrchestratorDdtAnalyzer;
  private readonly pythonModulesClient: BackendPythonModulesClient;
  private readonly notificationService: NotificationService | null;

  public constructor(params: {
    documentArchiveService: DocumentArchiveService;
    documentIntelligenceService: DocumentIntelligenceService;
    quotationAnalyzer: NextOrchestratorQuotationAnalyzer;
    ddtAnalyzer: NextOrchestratorDdtAnalyzer;
    pythonModulesClient: BackendPythonModulesClient;
    notificationService?: NotificationService | null;
  }) {
    this.documentArchiveService = params.documentArchiveService;
    this.documentIntelligenceService = params.documentIntelligenceService;
    this.quotationAnalyzer = params.quotationAnalyzer;
    this.ddtAnalyzer = params.ddtAnalyzer;
    this.pythonModulesClient = params.pythonModulesClient;
    this.notificationService = params.notificationService ?? null;
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
                  },
                },
                module_tool: {
                  select: {
                    key: true,
                    runtime_kind: true,
                    handler_key: true,
                    configuration: true,
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
    const orderedNodes = this.buildExecutionOrder(run.workflow.nodes, run.workflow.edges, context);

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
          const output = await this.executeNode(context, node);
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
      },
    });

    if (!row) {
      throw new Error("Workflow run not found.");
    }

    let quotationSource: StepExecutionContext["quotationSource"] = null;
    if (row.project_id) {
      const versionLabel = row.project_version?.version_label
        ?? (typeof row.input_payload === "object" && row.input_payload && "versionLabel" in row.input_payload
          ? String((row.input_payload as Record<string, unknown>).versionLabel ?? "")
          : "")
        ?? "";
      if (versionLabel) {
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

    return {
      workspaceId: row.workspace_id,
      runId: row.id,
      workflowKey: row.workflow.key,
      moduleKey: row.workflow.module?.key ?? null,
      projectId: row.project_id,
      projectVersionLabel: row.project_version?.version_label ?? null,
      projectVersionId: row.project_version_id,
      clientId: row.project_version?.client?.id ?? row.client_id ?? null,
      clientEmail: row.project_version?.client?.email?.trim() || null,
      clientName,
      projectName: row.project_version?.project?.name?.trim() || null,
      documentId: row.document_id,
      ddtDocumentId: row.ddt_document_id,
      quotationSource,
      ddtSource,
      inputPayload: (row.input_payload ?? null) as Record<string, unknown> | null,
      nodeOutputs: new Map<string, unknown>(),
    };
  }

  private buildExecutionOrder(
    nodes: WorkflowNodeRow[],
    edges: Array<{
      source_node_id: string;
      target_node_id: string;
      is_enabled: boolean;
      order_no: number;
      condition_payload: Prisma.JsonValue | null;
    }>,
    context: StepExecutionContext,
  ): WorkflowNodeRow[] {
    const eligibleNodes = nodes.filter((node) => node.is_enabled || node.is_required);
    const eligibleNodeIds = new Set(eligibleNodes.map((node) => node.id));
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const node of eligibleNodes) {
      incoming.set(node.id, 0);
      outgoing.set(node.id, []);
    }

    for (const edge of edges) {
      if (!edge.is_enabled) {
        continue;
      }
      if (!eligibleNodeIds.has(edge.source_node_id) || !eligibleNodeIds.has(edge.target_node_id)) {
        continue;
      }
      if (!this.evaluateCondition(edge.condition_payload as ConditionPayload | null, context)) {
        continue;
      }

      outgoing.get(edge.source_node_id)?.push(edge.target_node_id);
      incoming.set(edge.target_node_id, (incoming.get(edge.target_node_id) ?? 0) + 1);
    }

    const ordered: WorkflowNodeRow[] = [];
    const queue = eligibleNodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
    const byId = new Map(eligibleNodes.map((node) => [node.id, node]));

    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      const current = byId.get(currentId);
      if (!current) {
        continue;
      }
      ordered.push(current);
      for (const targetId of outgoing.get(currentId) ?? []) {
        const next = (incoming.get(targetId) ?? 0) - 1;
        incoming.set(targetId, next);
        if (next === 0) {
          queue.push(targetId);
        }
      }
    }

    for (const node of eligibleNodes) {
      if (!ordered.some((item) => item.id === node.id)) {
        ordered.push(node);
      }
    }

    return ordered;
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
      module_agent: { key: string; active_prompt: string; original_prompt: string } | null;
    },
  ): Promise<unknown> {
    const agentKey = node.module_agent?.key ?? node.node_key;
    if (agentKey === "quotation_structuring_prompt" || node.node_key === "quotation_structuring_agent") {
      if (!context.quotationSource) {
        throw new Error("Sorgente preventivo mancante.");
      }
      const analysis = await this.quotationAnalyzer.analyze({
        workspaceId: context.workspaceId,
        projectId: context.projectId ?? "",
        storagePath: context.quotationSource.storagePath,
        fileName: context.quotationSource.fileName,
      });
      return {
        structured_data: analysis.structuredData,
        raw_response: analysis.rawResponse,
      };
    }

    if (agentKey === "ddt_analysis_prompt" || node.node_key === "ddt_analysis_agent") {
      if (!context.ddtDocumentId) {
        throw new Error("ddtDocumentId mancante nel run.");
      }
      const analysis = await this.ddtAnalyzer.analyze(context.ddtDocumentId);
      return analysis;
    }

    throw new Error(`Agent node non supportato: ${agentKey}`);
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

      const input = this.buildPythonToolInput(context, node.node_key, moduleName, action);
      return this.pythonModulesClient.execute(moduleName, action, input);
    }

    if (tool.runtime_kind === "BACKEND") {
      return this.executeBackendTool(context, tool.handler_key);
    }

    if (tool.runtime_kind === "NEXT_ORCHESTRATOR") {
      throw new Error(`Runtime tool non ancora implementato: ${tool.runtime_kind}`);
    }

    throw new Error(`Runtime tool non supportato: ${tool.runtime_kind}`);
  }

  private buildPythonToolInput(
    context: StepExecutionContext,
    nodeKey: string,
    moduleName: string,
    action: string,
  ): Record<string, unknown> {
    if (moduleName === "ocr_engine" && action === "extract_text_from_pdf_storage") {
      const source = context.quotationSource ?? context.ddtSource;
      if (!source) {
        throw new Error("Sorgente PDF mancante per OCR.");
      }
      return {
        storage_path: source.storagePath,
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
      };
    }

    const fromConfig = this.findNodeOutput(context, nodeKey);
    return typeof fromConfig === "object" && fromConfig ? fromConfig as Record<string, unknown> : {};
  }

  private async executeBackendTool(context: StepExecutionContext, handlerKey: string): Promise<unknown> {
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

  private async handlePreStepStatus(context: StepExecutionContext, nodeKey: string): Promise<void> {
    if (!context.ddtDocumentId) {
      return;
    }

    if (nodeKey === "ddt_ocr_tool") {
      await this.updateDdtDocumentStatus(context.ddtDocumentId, "OCR_PROCESSING");
      return;
    }
    if (nodeKey === "ddt_analysis_agent") {
      await this.updateDdtDocumentStatus(context.ddtDocumentId, "AI_PROCESSING");
    }
  }

  private async handleRunFailureStatus(context: StepExecutionContext, message: string): Promise<void> {
    if (!context.ddtDocumentId) {
      return;
    }
    await this.updateDdtDocumentStatus(context.ddtDocumentId, "ERROR", message);
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
