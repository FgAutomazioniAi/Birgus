export class ProjectEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly statusKey: string;
  public readonly clientId: string | null;
  public readonly authorId: number | null;
  public readonly authorName: string;
  public readonly revisionId: number | null;
  public readonly revisionCode: string;
  public readonly publisherName: string;
  public readonly publicationDate: Date | null;
  public readonly authorDate: Date | null;
  public readonly createdAt: Date;
  public readonly versionsCount: number;

  public constructor(params: {
    id: string;
    workspaceId: string;
    name: string;
    statusKey: string;
    clientId?: string | null;
    authorId?: number | null;
    authorName?: string | null;
    revisionId?: number | null;
    revisionCode?: string | null;
    publisherName?: string | null;
    publicationDate?: Date | null;
    authorDate?: Date | null;
    createdAt: Date;
    versionsCount: number;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.name = params.name;
    this.statusKey = params.statusKey;
    this.clientId = params.clientId ?? null;
    this.authorId = params.authorId ?? null;
    this.authorName = params.authorName ?? "";
    this.revisionId = params.revisionId ?? null;
    this.revisionCode = params.revisionCode ?? "";
    this.publisherName = params.publisherName ?? "";
    this.publicationDate = params.publicationDate ?? null;
    this.authorDate = params.authorDate ?? null;
    this.createdAt = params.createdAt;
    this.versionsCount = params.versionsCount;
  }
}
