export class DdtDocumentEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly documentId: string;
  public readonly status: string;
  public readonly originalFileName: string | null;

  public constructor(params: {
    id: string;
    workspaceId: string;
    documentId: string;
    status: string;
    originalFileName: string | null;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.documentId = params.documentId;
    this.status = params.status;
    this.originalFileName = params.originalFileName;
  }
}
