export type DdtReaderDocumentStatus =
  | "uploaded"
  | "queued"
  | "ocr_processing"
  | "ai_processing"
  | "ready"
  | "error";

export interface DdtReaderArticleItem {
  article_type: string;
  quantity: number;
  unit: string;
}

export interface DdtReaderDocument {
  id: number;
  original_filename: string;
  status: DdtReaderDocumentStatus | string;
  movement_type?: "entrata" | "uscita" | "sconosciuto" | string | null;
  movement_scope?: "interno_fg" | "esterno" | "sconosciuto" | string | null;
  main_warehouse_action?:
    | "aggiunta_principale"
    | "rimozione_principale"
    | "invariato"
    | "sconosciuto"
    | string
    | null;
  bolla_number?: string | null;
  commessa_reference?: string | null;
  transfer_note?: string | null;
  article_count?: number | null;
  warehouse_delta?: number | null;
  article_items?: DdtReaderArticleItem[];
  analysis_summary?: string | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DdtReaderConfig {
  single_document_mode: boolean;
  lm_model: string;
  lm_base_url: string;
}
