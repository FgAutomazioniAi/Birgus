export class CreateProjectVersionCommand {
  public readonly workspaceId: string;
  public readonly projectId: string;
  public readonly description: string;
  public readonly statusKey: string;
  public readonly clientId: string | null;

  public constructor(params: {
    workspaceId: string;
    projectId: string;
    description: string;
    statusKey: string;
    clientId: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.projectId = params.projectId;
    this.description = params.description.trim();
    this.statusKey = params.statusKey.trim();
    this.clientId = params.clientId;
  }
}
