export type WorkflowNodeKind = "INPUT" | "AGENT" | "TOOL" | "OUTPUT";
export type WorkflowRunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
export type WorkflowKnowledgeMode = "on_demand" | "saved" | "hybrid";

export interface WorkflowTool {
  id: string;
  moduleKey: string;
  key: string;
  name?: string;
  label: string;
  runtimeKind: string;
  handlerKey: string;
  description?: string | null;
  configuration?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export interface WorkflowSummary {
  id: string;
  moduleKey: string;
  key: string;
  name: string;
  label: string;
  description?: string | null;
  configuration?: unknown;
  versionNo: number;
  isEnabled: boolean;
  isDefault: boolean;
}

export interface WorkflowNodeDto {
  id: string;
  nodeKey: string;
  nodeKind: WorkflowNodeKind;
  label: string;
  positionX: number;
  positionY: number;
  moduleAgentId?: string | null;
  moduleToolId?: string | null;
  inputKind?: string | null;
  outputKind?: string | null;
  configuration?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
  isEnabled: boolean;
  isRequired: boolean;
}

export interface WorkflowEdgeDto {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
  conditionPayload?: unknown;
  orderNo: number;
  isEnabled: boolean;
}

export interface WorkflowDetail extends WorkflowSummary {
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeDto[];
}

export interface WorkflowRunStep {
  id: string;
  sequenceNo?: number;
  stepKey?: string;
  workflowNodeId?: string | null;
  nodeKey?: string | null;
  label?: string | null;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  completedAt?: string | null;
  inputPayload?: unknown;
  outputPayload?: unknown;
  errorMessage?: string | null;
}

export interface WorkflowRun {
  id: string;
  status: WorkflowRunStatus;
  workflowKey?: string;
  triggerSource?: string | null;
  inputPayload?: unknown;
  resultPayload?: unknown;
  errorMessage?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  finishedAt?: string | null;
  steps?: WorkflowRunStep[];
}

export interface WorkflowAgent {
  id: string;
  moduleKey: string;
  moduleName: string;
  key: string;
  name: string;
  label: string;
  originalPrompt: string;
  activePrompt: string;
  isEnabled: boolean;
  updatedAt: string;
}
