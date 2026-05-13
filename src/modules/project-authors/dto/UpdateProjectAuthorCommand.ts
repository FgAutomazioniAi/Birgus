export class UpdateProjectAuthorCommand {
  public readonly workspaceId: string;
  public readonly authorId: number;
  public readonly firstName: string;
  public readonly lastName: string;
  public readonly displayName: string;
  public readonly notes: string;
  public readonly actorUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    authorId: number;
    firstName: string;
    lastName?: string | null;
    displayName?: string | null;
    notes?: string | null;
    actorUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.authorId = params.authorId;
    this.firstName = params.firstName.trim();
    this.lastName = params.lastName?.trim() || "";
    this.displayName = params.displayName?.trim() || "";
    this.notes = params.notes?.trim() || "";
    this.actorUserId = params.actorUserId ?? null;
  }
}
