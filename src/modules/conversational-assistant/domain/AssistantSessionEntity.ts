export class AssistantSessionEntity {
  public readonly id!: string;
  public readonly workspaceId!: string;
  public readonly openedByUserId!: string | null;
  public readonly moduleId!: number | null;
  public readonly title!: string | null;
  public readonly status!: string;
  public readonly contextEntityType!: string | null;
  public readonly contextEntityId!: string | null;
  public readonly projectId!: string | null;
  public readonly projectVersionId!: number | null;
  public readonly clientId!: string | null;
  public readonly documentId!: string | null;
  public readonly ddtDocumentId!: string | null;
  public readonly configuration!: Record<string, unknown> | null;
  public readonly openedAt!: Date;
  public readonly lastActivityAt!: Date;
  public readonly closedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    openedByUserId: string | null;
    moduleId: number | null;
    title: string | null;
    status: string;
    contextEntityType: string | null;
    contextEntityId: string | null;
    projectId: string | null;
    projectVersionId: number | null;
    clientId: string | null;
    documentId: string | null;
    ddtDocumentId: string | null;
    configuration: Record<string, unknown> | null;
    openedAt: Date;
    lastActivityAt: Date;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    Object.assign(this, params);
  }
}
