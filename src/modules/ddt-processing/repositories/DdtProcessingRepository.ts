import { DdtDocumentEntity } from "../domain/DdtDocumentEntity.js";

export interface DdtAnalysisInput {
  movementType: string | null;
  movementScope: string | null;
  mainWarehouseAction: string | null;
  bollaNumber: string | null;
  commessaReference: string | null;
  transferNote: string | null;
  articleCount: number | null;
  warehouseDelta: number | null;
  summary: string | null;
  rawResponse: Record<string, unknown> | null;
  articleItems: Array<{ articleType: string; quantity: number; unit: string }>;
}

export interface DdtProcessingRepository {
  upsertDdtDocument(params: {
    workspaceId: string;
    documentId: string;
    requestedByUserId: string | null;
  }): Promise<DdtDocumentEntity>;
  createJob(workspaceId: string, ddtDocumentId: string): Promise<string>;
  updateJobStatus(jobId: string, status: "RUNNING" | "COMPLETED" | "FAILED", errorMessage?: string): Promise<void>;
  updateDocumentStatus(ddtDocumentId: string, status: "QUEUED" | "OCR_PROCESSING" | "AI_PROCESSING" | "READY" | "ERROR", lastError?: string | null): Promise<void>;
  appendEvent(jobId: string, ddtDocumentId: string, eventType: string, payload?: Record<string, unknown>): Promise<void>;
  saveAnalysis(ddtDocumentId: string, analysis: DdtAnalysisInput): Promise<void>;
}
