export class StartDdtProcessingCommand {
  public readonly workspaceId: string;
  public readonly documentId: string;
  public readonly requestedByUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    documentId: string;
    requestedByUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.documentId = params.documentId;
    this.requestedByUserId = params.requestedByUserId ?? null;
  }
}
