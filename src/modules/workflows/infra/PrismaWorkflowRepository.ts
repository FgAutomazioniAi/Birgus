import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { ModuleToolEntity } from "../domain/ModuleToolEntity.js";
import { ModuleWorkflowEdgeEntity, ModuleWorkflowEntity, ModuleWorkflowNodeEntity } from "../domain/ModuleWorkflowEntity.js";
import { ModuleWorkflowRunEntity, ModuleWorkflowRunStepEntity } from "../domain/ModuleWorkflowRunEntity.js";
import { WorkflowDefinitionInput, WorkflowRepository } from "../repositories/WorkflowRepository.js";

export class PrismaWorkflowRepository implements WorkflowRepository {
  public async listModuleTools(workspaceId: string, moduleKey?: string): Promise<ModuleToolEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.moduleTool.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
        ...(moduleKey ? { module: { key: moduleKey } } : {}),
      },
      include: {
        module: {
          select: {
            key: true,
          },
        },
      },
      orderBy: [{ module: { key: "asc" } }, { label: "asc" }],
    });

    return rows.map((row) => new ModuleToolEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      moduleKey: row.module.key,
      key: row.key,
      name: row.name,
      label: row.label,
      description: row.description,
      runtimeKind: row.runtime_kind,
      handlerKey: row.handler_key,
      inputSchema: row.input_schema,
      outputSchema: row.output_schema,
      configuration: row.configuration,
      isEnabled: row.is_enabled,
      updatedAt: row.updated_at,
    }));
  }

  public async listWorkflows(workspaceId: string, moduleKey?: string): Promise<ModuleWorkflowEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.moduleWorkflow.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
        ...(moduleKey ? { module: { key: moduleKey } } : {}),
      },
      include: {
        module: { select: { key: true } },
        _count: { select: { nodes: true, edges: true } },
      },
      orderBy: [{ module: { key: "asc" } }, { updated_at: "desc" }],
    });

    return rows.map((row) => new ModuleWorkflowEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      moduleKey: row.module.key,
      key: row.key,
      name: row.name,
      label: row.label,
      description: row.description,
      configuration: row.configuration,
      versionNo: row.version_no,
      isEnabled: row.is_enabled,
      isDefault: row.is_default,
      nodes: [],
      edges: [],
      updatedAt: row.updated_at,
    }));
  }

  public async findWorkflowById(workspaceId: string, workflowId: string): Promise<ModuleWorkflowEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.moduleWorkflow.findFirst({
      where: {
        id: workflowId,
        workspace_id: workspaceId,
        deleted_at: null,
      },
      include: {
        module: { select: { key: true } },
        nodes: { orderBy: { created_at: "asc" } },
        edges: { orderBy: [{ order_no: "asc" }, { created_at: "asc" }] },
      },
    });

    return row ? this.mapWorkflow(row) : null;
  }

  public async findWorkflowByKey(workspaceId: string, moduleKey: string, workflowKey: string): Promise<ModuleWorkflowEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.moduleWorkflow.findFirst({
      where: {
        workspace_id: workspaceId,
        key: workflowKey,
        is_enabled: true,
        deleted_at: null,
        module: {
          key: moduleKey,
          is_active: true,
        },
      },
      include: {
        module: { select: { key: true } },
        nodes: { orderBy: { created_at: "asc" } },
        edges: { orderBy: [{ order_no: "asc" }, { created_at: "asc" }] },
      },
    });

    return row ? this.mapWorkflow(row) : null;
  }

  public async saveWorkflowDefinition(input: WorkflowDefinitionInput): Promise<ModuleWorkflowEntity> {
    const prisma = PrismaClientManager.getClient();
    const moduleRecord = await prisma.module.findFirst({
      where: {
        key: input.moduleKey,
        is_active: true,
      },
      select: { id: true },
    });
    if (!moduleRecord) {
      throw new AppError(`Module '${input.moduleKey}' not found.`, "WORKFLOW_MODULE_NOT_FOUND", 404);
    }

    const saved = await prisma.$transaction(async (tx) => {
      const existing = input.workflowId
        ? await tx.moduleWorkflow.findFirst({
            where: {
              id: input.workflowId,
              workspace_id: input.workspaceId,
              deleted_at: null,
            },
            select: { id: true },
          })
        : await tx.moduleWorkflow.findFirst({
            where: {
              workspace_id: input.workspaceId,
              module_id: moduleRecord.id,
              key: input.key,
              deleted_at: null,
            },
            select: { id: true },
          });

      const workflow = existing
        ? await tx.moduleWorkflow.update({
            where: { id: existing.id },
            data: {
              key: input.key,
              name: input.name,
              label: input.label,
              description: input.description,
              configuration: input.configuration as never,
              is_enabled: input.isEnabled,
              is_default: input.isDefault,
              updated_by_user_id: input.actorUserId,
              ...(input.incrementVersion === false ? {} : { version_no: { increment: 1 } }),
              deleted_at: null,
            },
          })
        : await tx.moduleWorkflow.create({
            data: {
              workspace_id: input.workspaceId,
              module_id: moduleRecord.id,
              key: input.key,
              name: input.name,
              label: input.label,
              description: input.description,
              configuration: input.configuration as never,
              is_enabled: input.isEnabled,
              is_default: input.isDefault,
              created_by_user_id: input.actorUserId,
              updated_by_user_id: input.actorUserId,
            },
          });

      const existingNodes = await tx.moduleWorkflowNode.findMany({
        where: {
          workflow_id: workflow.id,
        },
        select: {
          id: true,
          node_key: true,
          node_kind: true,
          label: true,
          position_x: true,
          position_y: true,
          module_agent_id: true,
          module_tool_id: true,
          input_kind: true,
          output_kind: true,
          configuration: true,
          input_schema: true,
          output_schema: true,
          is_enabled: true,
          is_required: true,
        },
      });
      const existingNodeByKey = new Map(existingNodes.map((row) => [row.node_key, row.id]));
      const normalizedNodes = [...input.nodes];

      const nextNodeIds = new Set<string>();
      const nodeIdByKey = new Map<string, string>();

      for (const node of normalizedNodes) {
        const targetId = node.id ?? existingNodeByKey.get(node.nodeKey) ?? null;
        const resolvedIsRequired = node.isRequired ?? false;
        const resolvedIsEnabled = resolvedIsRequired ? true : node.isEnabled;
        const savedNode = targetId
          ? await tx.moduleWorkflowNode.update({
              where: { id: targetId },
              data: {
                node_key: node.nodeKey,
                node_kind: node.nodeKind as never,
                label: node.label,
                position_x: node.positionX,
                position_y: node.positionY,
                module_agent_id: node.moduleAgentId ?? null,
                module_tool_id: node.moduleToolId ?? null,
                input_kind: node.inputKind ?? null,
                output_kind: node.outputKind ?? null,
                configuration: node.configuration as never,
                input_schema: node.inputSchema as never,
                output_schema: node.outputSchema as never,
                is_enabled: resolvedIsEnabled,
                is_required: resolvedIsRequired,
              },
              select: { id: true },
            })
          : await tx.moduleWorkflowNode.create({
              data: {
                workflow_id: workflow.id,
                workspace_id: input.workspaceId,
                node_key: node.nodeKey,
                node_kind: node.nodeKind as never,
                label: node.label,
                position_x: node.positionX,
                position_y: node.positionY,
                module_agent_id: node.moduleAgentId ?? null,
                module_tool_id: node.moduleToolId ?? null,
                input_kind: node.inputKind ?? null,
                output_kind: node.outputKind ?? null,
                configuration: node.configuration as never,
                input_schema: node.inputSchema as never,
                output_schema: node.outputSchema as never,
                is_enabled: resolvedIsEnabled,
                is_required: resolvedIsRequired,
              },
              select: { id: true },
            });

        nextNodeIds.add(savedNode.id);
        nodeIdByKey.set(node.nodeKey, savedNode.id);
      }

      const staleNodeIds = existingNodes.filter((row) => !nextNodeIds.has(row.id)).map((row) => row.id);
      if (staleNodeIds.length > 0) {
        await tx.moduleWorkflowEdge.deleteMany({
          where: {
            OR: [
              { source_node_id: { in: staleNodeIds } },
              { target_node_id: { in: staleNodeIds } },
            ],
          },
        });
        await tx.moduleWorkflowNode.deleteMany({
          where: {
            id: { in: staleNodeIds },
          },
        });
      }

      await tx.moduleWorkflowEdge.deleteMany({
        where: { workflow_id: workflow.id },
      });
      if (input.edges.length > 0) {
        await tx.moduleWorkflowEdge.createMany({
          data: input.edges.map((edge) => {
            const sourceNodeId = nodeIdByKey.get(edge.sourceNodeKey);
            const targetNodeId = nodeIdByKey.get(edge.targetNodeKey);
            if (!sourceNodeId || !targetNodeId) {
              throw new AppError("Workflow edge references unknown nodes.", "WORKFLOW_EDGE_INVALID", 400);
            }

            return {
              workflow_id: workflow.id,
              workspace_id: input.workspaceId,
              source_node_id: sourceNodeId,
              target_node_id: targetNodeId,
              source_handle: edge.sourceHandle ?? null,
              target_handle: edge.targetHandle ?? null,
              label: edge.label ?? null,
              condition_payload: edge.conditionPayload as never,
              order_no: edge.orderNo,
              is_enabled: edge.isEnabled,
            };
          }),
        });
      }

      return workflow.id;
    });

    const workflow = await this.findWorkflowById(input.workspaceId, saved);
    if (!workflow) {
      throw new AppError("Workflow not found after save.", "WORKFLOW_NOT_FOUND", 404);
    }
    return workflow;
  }

  public async listWorkflowRuns(workspaceId: string, workflowId?: string): Promise<ModuleWorkflowRunEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.moduleWorkflowRun.findMany({
      where: {
        workspace_id: workspaceId,
        ...(workflowId ? { workflow_id: workflowId } : {}),
      },
      include: {
        workflow: { select: { id: true, key: true } },
        module: { select: { key: true } },
      },
      orderBy: { queued_at: "desc" },
      take: 100,
    });

    return rows.map((row) => new ModuleWorkflowRunEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      workflowId: row.workflow_id,
      workflowKey: row.workflow.key,
      moduleKey: row.module?.key ?? null,
      status: row.status,
      triggerSource: row.trigger_source,
      contextEntityType: row.context_entity_type,
      contextEntityId: row.context_entity_id,
      projectId: row.project_id,
      projectVersionId: row.project_version_id,
      clientId: row.client_id,
      documentId: row.document_id,
      ddtDocumentId: row.ddt_document_id,
      measureReportDocumentId: row.measure_report_document_id,
      inputPayload: row.input_payload,
      resultPayload: row.result_payload,
      errorMessage: row.error_message,
      queuedAt: row.queued_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      steps: [],
    }));
  }

  public async findWorkflowRunById(workspaceId: string, runId: string): Promise<ModuleWorkflowRunEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.moduleWorkflowRun.findFirst({
      where: {
        id: runId,
        workspace_id: workspaceId,
      },
      include: {
        workflow: { select: { id: true, key: true } },
        module: { select: { key: true } },
        steps: { orderBy: { sequence_no: "asc" } },
      },
    });

    if (!row) {
      return null;
    }

    return new ModuleWorkflowRunEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      workflowId: row.workflow_id,
      workflowKey: row.workflow.key,
      moduleKey: row.module?.key ?? null,
      status: row.status,
      triggerSource: row.trigger_source,
      contextEntityType: row.context_entity_type,
      contextEntityId: row.context_entity_id,
      projectId: row.project_id,
      projectVersionId: row.project_version_id,
      clientId: row.client_id,
      documentId: row.document_id,
      ddtDocumentId: row.ddt_document_id,
      measureReportDocumentId: row.measure_report_document_id,
      inputPayload: row.input_payload,
      resultPayload: row.result_payload,
      errorMessage: row.error_message,
      queuedAt: row.queued_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      steps: row.steps.map((step) => new ModuleWorkflowRunStepEntity({
        id: step.id,
        workflowNodeId: step.workflow_node_id,
        sequenceNo: step.sequence_no,
        stepKey: step.step_key,
        status: step.status,
        startedAt: step.started_at,
        completedAt: step.completed_at,
        inputPayload: step.input_payload,
        outputPayload: step.output_payload,
        errorMessage: step.error_message,
        logsText: step.logs_text,
      })),
    });
  }

  public async createWorkflowRun(params: {
    workspaceId: string;
    workflowId: string;
    requestedByUserId: string | null;
    triggerSource: string | null;
    contextEntityType: string | null;
    contextEntityId: string | null;
    projectId: string | null;
    projectVersionId: number | null;
    clientId: string | null;
    documentId: string | null;
    ddtDocumentId: string | null;
    measureReportDocumentId: string | null;
    inputPayload: unknown | null;
  }): Promise<ModuleWorkflowRunEntity> {
    const prisma = PrismaClientManager.getClient();
    const workflow = await prisma.moduleWorkflow.findFirst({
      where: {
        id: params.workflowId,
        workspace_id: params.workspaceId,
        deleted_at: null,
      },
      include: {
        module: { select: { id: true, key: true } },
      },
    });
    if (!workflow) {
      throw new AppError("Workflow not found.", "WORKFLOW_NOT_FOUND", 404);
    }

    const created = await prisma.moduleWorkflowRun.create({
      data: {
        workspace_id: params.workspaceId,
        workflow_id: workflow.id,
        module_id: workflow.module.id,
        requested_by_user_id: params.requestedByUserId,
        status: "QUEUED",
        trigger_source: params.triggerSource,
        context_entity_type: params.contextEntityType,
        context_entity_id: params.contextEntityId,
        project_id: params.projectId,
        project_version_id: params.projectVersionId,
        client_id: params.clientId,
        document_id: params.documentId,
        ddt_document_id: params.ddtDocumentId,
        measure_report_document_id: params.measureReportDocumentId,
        input_payload: params.inputPayload as never,
      },
    });

    const run = await this.findWorkflowRunById(params.workspaceId, created.id);
    if (!run) {
      throw new AppError("Workflow run not found after creation.", "WORKFLOW_RUN_NOT_FOUND", 404);
    }
    return run;
  }

  public async deletePersonalWorkflow(workspaceId: string, workflowId: string, actorUserId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.moduleWorkflow.updateMany({
      where: {
        id: workflowId,
        workspace_id: workspaceId,
        deleted_at: null,
        module: { key: "workflow_management" },
      },
      data: {
        deleted_at: new Date(),
        is_enabled: false,
        updated_by_user_id: actorUserId,
      },
    });
  }

  private mapWorkflow(row: {
    id: string;
    workspace_id: string;
    key: string;
    name: string;
    label: string;
    description: string | null;
    configuration: unknown | null;
    version_no: number;
    is_enabled: boolean;
    is_default: boolean;
    updated_at: Date;
    module: { key: string };
    nodes: Array<{
      id: string;
      node_key: string;
      node_kind: string;
      label: string;
      position_x: number;
      position_y: number;
      module_agent_id: string | null;
      module_tool_id: string | null;
      input_kind: string | null;
      output_kind: string | null;
      configuration: unknown | null;
      input_schema: unknown | null;
      output_schema: unknown | null;
      is_enabled: boolean;
      is_required: boolean;
    }>;
    edges: Array<{
      id: string;
      source_node_id: string;
      target_node_id: string;
      source_handle: string | null;
      target_handle: string | null;
      label: string | null;
      condition_payload: unknown | null;
      order_no: number;
      is_enabled: boolean;
    }>;
  }): ModuleWorkflowEntity {
    return new ModuleWorkflowEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      moduleKey: row.module.key,
      key: row.key,
      name: row.name,
      label: row.label,
      description: row.description,
      versionNo: row.version_no,
      isEnabled: row.is_enabled,
      isDefault: row.is_default,
      updatedAt: row.updated_at,
      nodes: row.nodes.map((node) => new ModuleWorkflowNodeEntity({
        id: node.id,
        nodeKey: node.node_key,
        nodeKind: node.node_kind,
        label: node.label,
        positionX: node.position_x,
        positionY: node.position_y,
        moduleAgentId: node.module_agent_id,
        moduleToolId: node.module_tool_id,
        inputKind: node.input_kind,
        outputKind: node.output_kind,
        configuration: node.configuration,
        inputSchema: node.input_schema,
        outputSchema: node.output_schema,
        isEnabled: node.is_enabled,
        isRequired: node.is_required,
      })),
      edges: row.edges.map((edge) => new ModuleWorkflowEdgeEntity({
        id: edge.id,
        sourceNodeId: edge.source_node_id,
        targetNodeId: edge.target_node_id,
        sourceHandle: edge.source_handle,
        targetHandle: edge.target_handle,
        label: edge.label,
        conditionPayload: edge.condition_payload,
        orderNo: edge.order_no,
        isEnabled: edge.is_enabled,
      })),
    });
  }
}
