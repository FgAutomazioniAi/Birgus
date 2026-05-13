export class CreateProjectCommand {
  public readonly workspaceId: string;
  public readonly projectName: string;
  public readonly statusKey: string;
  public readonly clientId: string;
  public readonly ownerUserId: string;
  public readonly authorId: number | null;
  public readonly revisionId: number | null;
  public readonly publisherName: string;
  public readonly publicationDate: Date | null;
  public readonly authorDate: Date | null;
  public readonly actorUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    projectName: string;
    statusKey: string;
    clientId: string;
    ownerUserId: string;
    authorId?: number | null;
    revisionId?: number | null;
    publisherName?: string | null;
    publicationDate?: Date | null;
    authorDate?: Date | null;
    actorUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.projectName = params.projectName.trim();
    this.statusKey = params.statusKey.trim();
    this.clientId = params.clientId;
    this.ownerUserId = params.ownerUserId;
    this.authorId = params.authorId ?? null;
    this.revisionId = params.revisionId ?? null;
    this.publisherName = params.publisherName?.trim() || "";
    this.publicationDate = params.publicationDate ?? null;
    this.authorDate = params.authorDate ?? null;
    this.actorUserId = params.actorUserId ?? null;
  }
}
