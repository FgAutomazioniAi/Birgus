export class ShipmentEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly code: string;
  public readonly clientId: string | null;
  public readonly statusKey: string;
  public readonly createdAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    code: string;
    clientId: string | null;
    statusKey: string;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.code = params.code;
    this.clientId = params.clientId;
    this.statusKey = params.statusKey;
    this.createdAt = params.createdAt;
  }
}
