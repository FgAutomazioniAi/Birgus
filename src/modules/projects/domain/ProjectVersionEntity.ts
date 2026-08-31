export class ProjectVersionEntity {
  public readonly id: number;
  public readonly workspaceId: string;
  public readonly projectId: string;
  public readonly versionLabel: string;
  public readonly description: string;
  public readonly clientId: string | null;
  public readonly clientName: string | null;
  public readonly statusKey: string | null;
  public readonly isDefault: boolean;
  public readonly createdAt: Date;

  public constructor(params: {
    id: number;
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    description: string;
    clientId: string | null;
    clientName?: string | null;
    statusKey: string | null;
    isDefault: boolean;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.projectId = params.projectId;
    this.versionLabel = params.versionLabel;
    this.description = params.description;
    this.clientId = params.clientId;
    this.clientName = params.clientName ?? null;
    this.statusKey = params.statusKey;
    this.isDefault = params.isDefault;
    this.createdAt = params.createdAt;
  }
}
