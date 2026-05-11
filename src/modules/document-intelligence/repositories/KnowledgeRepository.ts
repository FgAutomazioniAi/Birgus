import { KnowledgeDocumentEntity } from "../domain/KnowledgeDocumentEntity.js";
import { KnowledgeSearchHitEntity } from "../domain/KnowledgeSearchHitEntity.js";

export interface SourceDocumentRecord {
  id: string;
  workspaceId: string;
  moduleId: number | null;
  nodePath: string;
  domainEntityType: string | null;
  domainEntityId: string | null;
  filename: string | null;
  storagePath: string;
  contentType: string | null;
  deletedAt: Date | null;
}

export interface KnowledgeChunkWriteModel {
  chunkIndex: number;
  contentText: string;
  tokenEstimate: number;
  embeddingStatus: string;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  embeddingVector: number[] | null;
  embeddingPayload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  embeddedAt: Date | null;
}

export interface KnowledgeRepository {
  findSourceDocumentById(workspaceId: string, documentId: string): Promise<SourceDocumentRecord | null>;
  findKnowledgeDocumentByDocumentId(workspaceId: string, documentId: string, representationKey: string): Promise<KnowledgeDocumentEntity | null>;
  upsertKnowledgeDocument(params: {
    workspaceId: string;
    documentId: string | null;
    moduleId: number | null;
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
  }): Promise<KnowledgeDocumentEntity>;
  replaceKnowledgeChunks(workspaceId: string, knowledgeDocumentId: string, chunks: KnowledgeChunkWriteModel[]): Promise<void>;
  semanticSearch(params: {
    workspaceId: string;
    queryVector: number[];
    topK: number;
    moduleId?: number | null;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
  }): Promise<KnowledgeSearchHitEntity[]>;
  keywordSearch(params: {
    workspaceId: string;
    queryText: string;
    topK: number;
    moduleId?: number | null;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
  }): Promise<KnowledgeSearchHitEntity[]>;
}
