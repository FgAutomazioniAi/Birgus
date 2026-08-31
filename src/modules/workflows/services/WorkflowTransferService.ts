import { AppError } from "../../../core/errors/AppError.js";
import { ModuleAccessPolicy } from "../../../core/module-access/ModuleAccessPolicy.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { WorkflowDefinitionInput } from "../repositories/WorkflowRepository.js";
import { WorkflowService } from "./WorkflowService.js";

export const WORKFLOW_TRANSFER_FORMAT = "birgus.workflow";
export const WORKFLOW_TRANSFER_VERSION = 1;

export type WorkflowResourceReference = {
  moduleKey: string;
  key: string;
};

export type WorkflowTransferDocument = {
  format: typeof WORKFLOW_TRANSFER_FORMAT;
  version: typeof WORKFLOW_TRANSFER_VERSION;
  exportedAt: string;
  workflow: {
    moduleKey: string;
    key: string;
    name: string;
    label: string;
    description: string | null;
    configuration: unknown | null;
    nodes: Array<Omit<WorkflowDefinitionInput["nodes"][number], "id" | "moduleAgentId" | "moduleToolId"> & {
      agent?: WorkflowResourceReference;
      tool?: WorkflowResourceReference;
    }>;
    edges: Array<Omit<WorkflowDefinitionInput["edges"][number], "id">>;
  };
};

/** Converts a workflow definition between workspaces without carrying database IDs across. */
export class WorkflowTransferService {
  public constructor(
    private readonly workflowService: WorkflowService,
    private readonly moduleAccessPolicy: ModuleAccessPolicy,
  ) {}

  public async exportWorkflow(workspaceId: string, workflowId: string): Promise<WorkflowTransferDocument> {
    const workflow = await this.workflowService.getWorkflow(workspaceId, workflowId);
    const agentReferences = await this.findResourceReferences(workspaceId, "agent", workflow.nodes.map((node) => node.moduleAgentId));
    const toolReferences = await this.findResourceReferences(workspaceId, "tool", workflow.nodes.map((node) => node.moduleToolId));
    const nodeKeyById = new Map(workflow.nodes.map((node) => [node.id, node.nodeKey]));

    return {
      format: WORKFLOW_TRANSFER_FORMAT,
      version: WORKFLOW_TRANSFER_VERSION,
      exportedAt: new Date().toISOString(),
      workflow: {
        moduleKey: workflow.moduleKey,
        key: workflow.key,
        name: workflow.name,
        label: workflow.label,
        description: workflow.description,
        configuration: workflow.configuration,
        nodes: workflow.nodes.map((node) => ({
          nodeKey: node.nodeKey,
          nodeKind: node.nodeKind,
          label: node.label,
          positionX: node.positionX,
          positionY: node.positionY,
          inputKind: node.inputKind,
          outputKind: node.outputKind,
          configuration: node.configuration,
          inputSchema: node.inputSchema,
          outputSchema: node.outputSchema,
          isEnabled: node.isEnabled,
          isRequired: node.isRequired,
          ...(node.moduleAgentId ? { agent: this.requireReference(agentReferences, node.moduleAgentId, "agente") } : {}),
          ...(node.moduleToolId ? { tool: this.requireReference(toolReferences, node.moduleToolId, "strumento") } : {}),
        })),
        edges: workflow.edges.map((edge) => {
          const sourceNodeKey = nodeKeyById.get(edge.sourceNodeId);
          const targetNodeKey = nodeKeyById.get(edge.targetNodeId);
          if (!sourceNodeKey || !targetNodeKey) {
            throw new AppError("Il workflow contiene un collegamento non esportabile.", "WORKFLOW_EXPORT_EDGE_INVALID", 409);
          }
          return {
            sourceNodeKey,
            targetNodeKey,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            label: edge.label,
            conditionPayload: edge.conditionPayload,
            orderNo: edge.orderNo,
            isEnabled: edge.isEnabled,
          };
        }),
      },
    };
  }

  public async importWorkflow(params: {
    workspaceId: string;
    actorUserId: string;
    document: WorkflowTransferDocument;
  }) {
    const document = params.document;
    const requiredModules = new Set<string>([document.workflow.moduleKey]);
    for (const node of document.workflow.nodes) {
      if (node.agent) requiredModules.add(node.agent.moduleKey);
      if (node.tool) requiredModules.add(node.tool.moduleKey);
    }

    const unavailableModules: string[] = [];
    for (const moduleKey of requiredModules) {
      try {
        await this.moduleAccessPolicy.ensureEnabledForWorkspace(params.workspaceId, moduleKey);
      } catch {
        unavailableModules.push(moduleKey);
      }
    }
    if (unavailableModules.length > 0) {
      throw new AppError(
        `Importazione non consentita: abilita prima i moduli nel workspace: ${unavailableModules.sort().join(", ")}.`,
        "WORKFLOW_IMPORT_MODULES_DISABLED",
        409,
      );
    }

    const resourceIds = await this.resolveResources(params.workspaceId, document.workflow.nodes);
    const importKey = await this.nextImportKey(params.workspaceId, document.workflow.moduleKey, document.workflow.key);
    const saved = await this.workflowService.saveWorkflowDefinition({
      workflowId: null,
      workspaceId: params.workspaceId,
      moduleKey: document.workflow.moduleKey,
      key: importKey,
      name: importKey,
      label: document.workflow.label,
      description: document.workflow.description,
      configuration: document.workflow.configuration,
      isEnabled: true,
      isDefault: false,
      incrementVersion: false,
      actorUserId: params.actorUserId,
      nodes: document.workflow.nodes.map((node) => ({
        nodeKey: node.nodeKey,
        nodeKind: node.nodeKind,
        label: node.label,
        positionX: node.positionX,
        positionY: node.positionY,
        moduleAgentId: node.agent ? resourceIds.agents.get(this.referenceKey(node.agent)) ?? null : null,
        moduleToolId: node.tool ? resourceIds.tools.get(this.referenceKey(node.tool)) ?? null : null,
        inputKind: node.inputKind,
        outputKind: node.outputKind,
        configuration: node.configuration,
        inputSchema: node.inputSchema,
        outputSchema: node.outputSchema,
        isEnabled: node.isEnabled,
        isRequired: node.isRequired,
      })),
      edges: document.workflow.edges,
    });

    return saved;
  }

  private async findResourceReferences(
    workspaceId: string,
    kind: "agent" | "tool",
    rawIds: Array<string | null>,
  ): Promise<Map<string, WorkflowResourceReference>> {
    const ids = rawIds.filter((id): id is string => Boolean(id));
    const references = new Map<string, WorkflowResourceReference>();
    if (ids.length === 0) return references;

    const prisma = PrismaClientManager.getClient();
    const rows = kind === "agent"
      ? await prisma.moduleAgent.findMany({ where: { id: { in: ids }, workspace_id: workspaceId, deleted_at: null }, include: { module: { select: { key: true } } } })
      : await prisma.moduleTool.findMany({ where: { id: { in: ids }, workspace_id: workspaceId, deleted_at: null }, include: { module: { select: { key: true } } } });
    for (const row of rows) references.set(row.id, { moduleKey: row.module.key, key: row.key });
    return references;
  }

  private requireReference(references: Map<string, WorkflowResourceReference>, id: string, kind: string): WorkflowResourceReference {
    const reference = references.get(id);
    if (!reference) throw new AppError(`Il workflow fa riferimento a un ${kind} non disponibile.`, "WORKFLOW_EXPORT_RESOURCE_MISSING", 409);
    return reference;
  }

  private async resolveResources(
    workspaceId: string,
    nodes: WorkflowTransferDocument["workflow"]["nodes"],
  ): Promise<{ agents: Map<string, string>; tools: Map<string, string> }> {
    const agentRefs = nodes.flatMap((node) => node.agent ? [node.agent] : []);
    const toolRefs = nodes.flatMap((node) => node.tool ? [node.tool] : []);
    const prisma = PrismaClientManager.getClient();
    const [agents, tools] = await Promise.all([
      agentRefs.length > 0 ? prisma.moduleAgent.findMany({ where: { workspace_id: workspaceId, deleted_at: null, is_enabled: true }, include: { module: { select: { key: true } } } }) : [],
      toolRefs.length > 0 ? prisma.moduleTool.findMany({ where: { workspace_id: workspaceId, deleted_at: null, is_enabled: true }, include: { module: { select: { key: true } } } }) : [],
    ]);
    const agentIds = new Map(agents.map((item) => [this.referenceKey({ moduleKey: item.module.key, key: item.key }), item.id]));
    const toolIds = new Map(tools.map((item) => [this.referenceKey({ moduleKey: item.module.key, key: item.key }), item.id]));
    const missing = [
      ...agentRefs.filter((reference) => !agentIds.has(this.referenceKey(reference))).map((reference) => `agente ${reference.moduleKey}/${reference.key}`),
      ...toolRefs.filter((reference) => !toolIds.has(this.referenceKey(reference))).map((reference) => `strumento ${reference.moduleKey}/${reference.key}`),
    ];
    if (missing.length > 0) {
      throw new AppError(`Importazione non possibile: mancano o sono disabilitati ${[...new Set(missing)].join(", ")}.`, "WORKFLOW_IMPORT_RESOURCES_MISSING", 409);
    }
    return { agents: agentIds, tools: toolIds };
  }

  private async nextImportKey(workspaceId: string, moduleKey: string, sourceKey: string): Promise<string> {
    const normalized = sourceKey.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "workflow";
    const key = `imported_${normalized}_${Date.now().toString(36)}`;
    const existing = await this.workflowService.findWorkflowByKey(workspaceId, moduleKey, key);
    return existing ? `${key}_${Math.random().toString(36).slice(2, 6)}` : key;
  }

  private referenceKey(reference: WorkflowResourceReference): string {
    return `${reference.moduleKey}:${reference.key}`;
  }
}
