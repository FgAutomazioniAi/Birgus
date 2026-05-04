export class ShipmentEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly projectId: string;
  public readonly projectName: string;
  public readonly projectVersionId: number;
  public readonly projectVersionLabel: string;
  public readonly code: string;
  public readonly clientId: string | null;
  public readonly clientName: string | null;
  public readonly statusKey: string;
  public readonly notes: string | null;
  public readonly specificationInput: unknown | null;
  public readonly specificationCalculation: unknown | null;
  public readonly specificationUpdatedAt: Date | null;
  public readonly createdAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    projectId: string;
    projectName: string;
    projectVersionId: number;
    projectVersionLabel: string;
    code: string;
    clientId: string | null;
    clientName?: string | null;
    statusKey: string;
    notes?: string | null;
    specificationInput?: unknown | null;
    specificationCalculation?: unknown | null;
    specificationUpdatedAt?: Date | null;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.projectId = params.projectId;
    this.projectName = params.projectName;
    this.projectVersionId = params.projectVersionId;
    this.projectVersionLabel = params.projectVersionLabel;
    this.code = params.code;
    this.clientId = params.clientId;
    this.clientName = params.clientName ?? null;
    this.statusKey = params.statusKey;
    this.notes = params.notes ?? null;
    this.specificationInput = params.specificationInput ?? null;
    this.specificationCalculation = params.specificationCalculation ?? null;
    this.specificationUpdatedAt = params.specificationUpdatedAt ?? null;
    this.createdAt = params.createdAt;
  }
}
