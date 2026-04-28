export class DeleteProjectVersionCommand {
  public readonly workspaceId: string;
  public readonly projectId: string;
  public readonly versionLabel: string;

  public constructor(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
  }) {
    this.workspaceId = params.workspaceId;
    this.projectId = params.projectId;
    this.versionLabel = params.versionLabel.trim().toLowerCase();
  }
}
