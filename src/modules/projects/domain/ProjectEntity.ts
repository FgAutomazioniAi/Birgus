export class ProjectEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly statusKey: string;
  public readonly clientId: string | null;
  public readonly createdAt: Date;
  public readonly versionsCount: number;

  public constructor(params: {
    id: string;
    workspaceId: string;
    name: string;
    statusKey: string;
    clientId?: string | null;
    createdAt: Date;
    versionsCount: number;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.name = params.name;
    this.statusKey = params.statusKey;
    this.clientId = params.clientId ?? null;
    this.createdAt = params.createdAt;
    this.versionsCount = params.versionsCount;
  }
}
