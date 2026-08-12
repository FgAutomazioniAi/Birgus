import { ModuleToolEntity } from "../domain/ModuleToolEntity.js";
import { ModuleWorkflowEntity, ModuleWorkflowEdgeEntity, ModuleWorkflowNodeEntity } from "../domain/ModuleWorkflowEntity.js";
import { ModuleWorkflowRunEntity } from "../domain/ModuleWorkflowRunEntity.js";

export type WorkflowDefinitionInput = {
  workflowId?: string | null;
  workspaceId: string;
  moduleKey: string;
  key: string;
  name: string;
  label: string;
  description: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  actorUserId: string | null;
  nodes: Array<{
    id?: string | null;
    nodeKey: string;
    nodeKind: string;
    label: string;
    positionX: number;
    positionY: number;
    moduleAgentId?: string | null;
    moduleToolId?: string | null;
    inputKind?: string | null;
    outputKind?: string | null;
    configuration?: unknown | null;
    inputSchema?: unknown | null;
    outputSchema?: unknown | null;
    isEnabled: boolean;
    isRequired?: boolean;
  }>;
  edges: Array<{
    id?: string | null;
    sourceNodeKey: string;
    targetNodeKey: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string | null;
    conditionPayload?: unknown | null;
    orderNo: number;
    isEnabled: boolean;
  }>;
};

export interface WorkflowRepository {
  listModuleTools(workspaceId: string, moduleKey?: string): Promise<ModuleToolEntity[]>;
  listWorkflows(workspaceId: string, moduleKey?: string): Promise<ModuleWorkflowEntity[]>;
  findWorkflowById(workspaceId: string, workflowId: string): Promise<ModuleWorkflowEntity | null>;
  findWorkflowByKey(workspaceId: string, moduleKey: string, workflowKey: string): Promise<ModuleWorkflowEntity | null>;
  saveWorkflowDefinition(input: WorkflowDefinitionInput): Promise<ModuleWorkflowEntity>;
  listWorkflowRuns(workspaceId: string, workflowId?: string): Promise<ModuleWorkflowRunEntity[]>;
  findWorkflowRunById(workspaceId: string, runId: string): Promise<ModuleWorkflowRunEntity | null>;
  createWorkflowRun(params: {
    workspaceId: string;
    workflowId: string;
    requestedByUserId: string | null;
    triggerSource: string | null;
    contextEntityType: string | null;
    contextEntityId: string | null;
    projectId: string | null;
    projectVersionId: number | null;
    clientId: string | null;
    shipmentId: string | null;
    documentId: string | null;
    ddtDocumentId: string | null;
    measureReportDocumentId: string | null;
    inputPayload: unknown | null;
  }): Promise<ModuleWorkflowRunEntity>;
}
