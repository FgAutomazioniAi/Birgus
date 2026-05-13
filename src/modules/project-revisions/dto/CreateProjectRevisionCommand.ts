export class CreateProjectRevisionCommand {
  public readonly workspaceId: string;
  public readonly code: string;
  public readonly actorUserId: string | null;

  public constructor(params: { workspaceId: string; code: string; actorUserId?: string | null }) {
    this.workspaceId = params.workspaceId;
    this.code = params.code.trim();
    this.actorUserId = params.actorUserId ?? null;
  }
}
