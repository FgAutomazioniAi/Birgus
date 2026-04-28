export class CreateShipmentCommand {
  public readonly workspaceId: string;
  public readonly code: string;
  public readonly clientId: string | null;
  public readonly statusKey: string;
  public readonly notes: string | null;
  public readonly createdByUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    code: string;
    clientId?: string | null;
    statusKey: string;
    notes?: string | null;
    createdByUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.code = params.code.trim();
    this.clientId = params.clientId ?? null;
    this.statusKey = params.statusKey.trim();
    this.notes = params.notes ?? null;
    this.createdByUserId = params.createdByUserId ?? null;
  }
}
