export class KnowledgeDocumentEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly moduleId: number | null;
  public readonly documentId: string | null;
  public readonly sourceEntityType: string;
  public readonly sourceEntityId: string;
  public readonly representationKey: string;
  public readonly title: string | null;
  public readonly sourceLabel: string | null;
  public readonly contentText: string | null;
  public readonly summaryText: string | null;
  public readonly structuredPayload: Record<string, unknown> | null;
  public readonly extractionStatus: string;
  public readonly extractionKind: string | null;
  public readonly contentHash: string | null;
  public readonly lastError: string | null;
  public readonly extractedAt: Date | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    moduleId: number | null;
    documentId: string | null;
    sourceEntityType: string;
    sourceEntityId: string;
    representationKey: string;
    title: string | null;
    sourceLabel: string | null;
    contentText: string | null;
    summaryText: string | null;
    structuredPayload: Record<string, unknown> | null;
    extractionStatus: string;
    extractionKind: string | null;
    contentHash: string | null;
    lastError: string | null;
    extractedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.moduleId = params.moduleId;
    this.documentId = params.documentId;
    this.sourceEntityType = params.sourceEntityType;
    this.sourceEntityId = params.sourceEntityId;
    this.representationKey = params.representationKey;
    this.title = params.title;
    this.sourceLabel = params.sourceLabel;
    this.contentText = params.contentText;
    this.summaryText = params.summaryText;
    this.structuredPayload = params.structuredPayload;
    this.extractionStatus = params.extractionStatus;
    this.extractionKind = params.extractionKind;
    this.contentHash = params.contentHash;
    this.lastError = params.lastError;
    this.extractedAt = params.extractedAt;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}
