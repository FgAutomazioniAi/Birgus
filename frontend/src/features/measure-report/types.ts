export type MeasureReportDocumentStatus =
  | "uploaded"
  | "queued"
  | "ai_processing"
  | "ready"
  | "error";

export interface MeasureReportRow {
  row_index: number;
  row_text: string;
  note: string | null;
  page_hint: string | null;
}

export interface MeasureReportDocument {
  id: string;
  original_filename: string;
  status: MeasureReportDocumentStatus | string;
  document_type_requested: string;
  document_type_effective: string | null;
  rows_count: number;
  out_of_tolerance_rows: MeasureReportRow[];
  analysis_summary: string | null;
  prompt_agent_key: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeasureReportConfig {
  single_document_mode: boolean;
  lm_model: string;
  lm_base_url: string;
  analysis_mode: string;
  document_types: Array<{
    value: string;
    label: string;
  }>;
}
