export class ModuleWorkflowRunStepEntity {
  public readonly id: string;
  public readonly workflowNodeId: string | null;
  public readonly sequenceNo: number;
  public readonly stepKey: string;
  public readonly status: string;
  public readonly startedAt: Date | null;
  public readonly completedAt: Date | null;
  public readonly inputPayload: unknown | null;
  public readonly outputPayload: unknown | null;
  public readonly errorMessage: string | null;
  public readonly logsText: string | null;

  public constructor(params: {
    id: string;
    workflowNodeId?: string | null;
    sequenceNo: number;
    stepKey: string;
    status: string;
    startedAt?: Date | null;
    completedAt?: Date | null;
    inputPayload?: unknown | null;
    outputPayload?: unknown | null;
    errorMessage?: string | null;
    logsText?: string | null;
  }) {
    this.id = params.id;
    this.workflowNodeId = params.workflowNodeId ?? null;
    this.sequenceNo = params.sequenceNo;
    this.stepKey = params.stepKey;
    this.status = params.status;
    this.startedAt = params.startedAt ?? null;
    this.completedAt = params.completedAt ?? null;
    this.inputPayload = params.inputPayload ?? null;
    this.outputPayload = params.outputPayload ?? null;
    this.errorMessage = params.errorMessage ?? null;
    this.logsText = params.logsText ?? null;
  }
}

export class ModuleWorkflowRunEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly workflowId: string;
  public readonly workflowKey: string;
  public readonly moduleKey: string | null;
  public readonly status: string;
  public readonly triggerSource: string | null;
  public readonly contextEntityType: string | null;
  public readonly contextEntityId: string | null;
  public readonly projectId: string | null;
  public readonly projectVersionId: number | null;
  public readonly clientId: string | null;
  public readonly documentId: string | null;
  public readonly ddtDocumentId: string | null;
  public readonly measureReportDocumentId: string | null;
  public readonly inputPayload: unknown | null;
  public readonly resultPayload: unknown | null;
  public readonly errorMessage: string | null;
  public readonly queuedAt: Date;
  public readonly startedAt: Date | null;
  public readonly completedAt: Date | null;
  public readonly steps: ModuleWorkflowRunStepEntity[];

  public constructor(params: {
    id: string;
    workspaceId: string;
    workflowId: string;
    workflowKey: string;
    moduleKey?: string | null;
    status: string;
    triggerSource?: string | null;
    contextEntityType?: string | null;
    contextEntityId?: string | null;
    projectId?: string | null;
    projectVersionId?: number | null;
    clientId?: string | null;
    documentId?: string | null;
    ddtDocumentId?: string | null;
    measureReportDocumentId?: string | null;
    inputPayload?: unknown | null;
    resultPayload?: unknown | null;
    errorMessage?: string | null;
    queuedAt: Date;
    startedAt?: Date | null;
    completedAt?: Date | null;
    steps?: ModuleWorkflowRunStepEntity[];
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.workflowId = params.workflowId;
    this.workflowKey = params.workflowKey;
    this.moduleKey = params.moduleKey ?? null;
    this.status = params.status;
    this.triggerSource = params.triggerSource ?? null;
    this.contextEntityType = params.contextEntityType ?? null;
    this.contextEntityId = params.contextEntityId ?? null;
    this.projectId = params.projectId ?? null;
    this.projectVersionId = params.projectVersionId ?? null;
    this.clientId = params.clientId ?? null;
    this.documentId = params.documentId ?? null;
    this.ddtDocumentId = params.ddtDocumentId ?? null;
    this.measureReportDocumentId = params.measureReportDocumentId ?? null;
    this.inputPayload = params.inputPayload ?? null;
    this.resultPayload = params.resultPayload ?? null;
    this.errorMessage = params.errorMessage ?? null;
    this.queuedAt = params.queuedAt;
    this.startedAt = params.startedAt ?? null;
    this.completedAt = params.completedAt ?? null;
    this.steps = params.steps ?? [];
  }
}
