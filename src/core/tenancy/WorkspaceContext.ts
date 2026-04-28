export class WorkspaceContext {
  public readonly workspaceId: string;
  public readonly userId: string;

  public constructor(workspaceId: string, userId: string) {
    this.workspaceId = workspaceId;
    this.userId = userId;
  }
}
