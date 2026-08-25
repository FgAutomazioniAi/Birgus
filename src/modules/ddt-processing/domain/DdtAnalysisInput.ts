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
