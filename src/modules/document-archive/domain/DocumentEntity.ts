export class DocumentEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly nodeId: string;
  public readonly filename: string | null;
  public readonly sizeBytes: number | null;
  public readonly storagePath: string;
  public readonly createdAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    nodeId: string;
    filename: string | null;
    sizeBytes: number | null;
    storagePath: string;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.nodeId = params.nodeId;
    this.filename = params.filename;
    this.sizeBytes = params.sizeBytes;
    this.storagePath = params.storagePath;
    this.createdAt = params.createdAt;
  }
}
