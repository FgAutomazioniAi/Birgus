export class ModuleWorkflowNodeEntity {
  public readonly id: string;
  public readonly nodeKey: string;
  public readonly nodeKind: string;
  public readonly label: string;
  public readonly positionX: number;
  public readonly positionY: number;
  public readonly moduleAgentId: string | null;
  public readonly moduleToolId: string | null;
  public readonly inputKind: string | null;
  public readonly outputKind: string | null;
  public readonly configuration: unknown | null;
  public readonly inputSchema: unknown | null;
  public readonly outputSchema: unknown | null;
  public readonly isEnabled: boolean;
  public readonly isRequired: boolean;

  public constructor(params: {
    id: string;
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
  }) {
    this.id = params.id;
    this.nodeKey = params.nodeKey;
    this.nodeKind = params.nodeKind;
    this.label = params.label;
    this.positionX = params.positionX;
    this.positionY = params.positionY;
    this.moduleAgentId = params.moduleAgentId ?? null;
    this.moduleToolId = params.moduleToolId ?? null;
    this.inputKind = params.inputKind ?? null;
    this.outputKind = params.outputKind ?? null;
    this.configuration = params.configuration ?? null;
    this.inputSchema = params.inputSchema ?? null;
    this.outputSchema = params.outputSchema ?? null;
    this.isEnabled = params.isEnabled;
    this.isRequired = params.isRequired ?? false;
  }
}

export class ModuleWorkflowEdgeEntity {
  public readonly id: string;
  public readonly sourceNodeId: string;
  public readonly targetNodeId: string;
  public readonly sourceHandle: string | null;
  public readonly targetHandle: string | null;
  public readonly label: string | null;
  public readonly conditionPayload: unknown | null;
  public readonly orderNo: number;
  public readonly isEnabled: boolean;

  public constructor(params: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string | null;
    conditionPayload?: unknown | null;
    orderNo: number;
    isEnabled: boolean;
  }) {
    this.id = params.id;
    this.sourceNodeId = params.sourceNodeId;
    this.targetNodeId = params.targetNodeId;
    this.sourceHandle = params.sourceHandle ?? null;
    this.targetHandle = params.targetHandle ?? null;
    this.label = params.label ?? null;
    this.conditionPayload = params.conditionPayload ?? null;
    this.orderNo = params.orderNo;
    this.isEnabled = params.isEnabled;
  }
}

export class ModuleWorkflowEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly moduleKey: string;
  public readonly key: string;
  public readonly name: string;
  public readonly label: string;
  public readonly description: string | null;
  public readonly configuration: unknown | null;
  public readonly versionNo: number;
  public readonly isEnabled: boolean;
  public readonly isDefault: boolean;
  public readonly nodes: ModuleWorkflowNodeEntity[];
  public readonly edges: ModuleWorkflowEdgeEntity[];
  public readonly updatedAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    moduleKey: string;
    key: string;
    name: string;
    label: string;
    description?: string | null;
    configuration?: unknown | null;
    versionNo: number;
    isEnabled: boolean;
    isDefault: boolean;
    nodes?: ModuleWorkflowNodeEntity[];
    edges?: ModuleWorkflowEdgeEntity[];
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.moduleKey = params.moduleKey;
    this.key = params.key;
    this.name = params.name;
    this.label = params.label;
    this.description = params.description ?? null;
    this.configuration = params.configuration ?? null;
    this.versionNo = params.versionNo;
    this.isEnabled = params.isEnabled;
    this.isDefault = params.isDefault;
    this.nodes = params.nodes ?? [];
    this.edges = params.edges ?? [];
    this.updatedAt = params.updatedAt;
  }
}
