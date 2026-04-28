export class CreateProjectCommand {
  public readonly workspaceId: string;
  public readonly projectName: string;
  public readonly statusKey: string;
  public readonly clientId: string;
  public readonly ownerUserId: string;

  public constructor(params: {
    workspaceId: string;
    projectName: string;
    statusKey: string;
    clientId: string;
    ownerUserId: string;
  }) {
    this.workspaceId = params.workspaceId;
    this.projectName = params.projectName.trim();
    this.statusKey = params.statusKey.trim();
    this.clientId = params.clientId;
    this.ownerUserId = params.ownerUserId;
  }
}
