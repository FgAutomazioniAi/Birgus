export class CreateShipmentCommand {
  public readonly workspaceId: string;
  public readonly projectVersionId: number;
  public readonly code: string | null;
  public readonly statusKey: string;
  public readonly notes: string | null;
  public readonly createdByUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    projectVersionId: number;
    code?: string | null;
    statusKey: string;
    notes?: string | null;
    createdByUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.projectVersionId = params.projectVersionId;
    this.code = params.code?.trim() ? params.code.trim() : null;
    this.statusKey = params.statusKey.trim();
    this.notes = params.notes ?? null;
    this.createdByUserId = params.createdByUserId ?? null;
  }
}
