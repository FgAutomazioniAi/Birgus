export class UpdateProjectRevisionCommand {
  public readonly workspaceId: string;
  public readonly revisionId: number;
  public readonly code: string;
  public readonly actorUserId: string | null;

  public constructor(params: { workspaceId: string; revisionId: number; code: string; actorUserId?: string | null }) {
    this.workspaceId = params.workspaceId;
    this.revisionId = params.revisionId;
    this.code = params.code.trim();
    this.actorUserId = params.actorUserId ?? null;
  }
}
