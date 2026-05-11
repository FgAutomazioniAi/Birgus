export class KnowledgeSearchHitEntity {
  public readonly chunkId: string;
  public readonly knowledgeDocumentId: string;
  public readonly documentId: string | null;
  public readonly sourceEntityType: string;
  public readonly sourceEntityId: string;
  public readonly title: string | null;
  public readonly sourceLabel: string | null;
  public readonly chunkIndex: number;
  public readonly contentText: string;
  public readonly distance: number;

  public constructor(params: {
    chunkId: string;
    knowledgeDocumentId: string;
    documentId: string | null;
    sourceEntityType: string;
    sourceEntityId: string;
    title: string | null;
    sourceLabel: string | null;
    chunkIndex: number;
    contentText: string;
    distance: number;
  }) {
    this.chunkId = params.chunkId;
    this.knowledgeDocumentId = params.knowledgeDocumentId;
    this.documentId = params.documentId;
    this.sourceEntityType = params.sourceEntityType;
    this.sourceEntityId = params.sourceEntityId;
    this.title = params.title;
    this.sourceLabel = params.sourceLabel;
    this.chunkIndex = params.chunkIndex;
    this.contentText = params.contentText;
    this.distance = params.distance;
  }
}
