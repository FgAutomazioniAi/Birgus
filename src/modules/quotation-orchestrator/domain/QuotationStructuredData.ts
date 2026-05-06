export const QUOTATION_FIELD_KEYS = [
  "Place",
  "Date",
  "Attn",
  "Company",
  "Address1",
  "Address2",
  "Reference",
  "Greeting",
  "Title",
  "Printing/Press",
  "Imposition",
  "Trim size",
  "Extent",
  "Text",
  "1st form",
  "Endpapers",
  "Casecover",
  "Dust jacket",
  "Binding",
  "Packing",
  "Cartons",
  "Transport",
  "Prices",
  "Extra costs",
  "ClosingHeaderAttn",
  "ClosingReference",
  "ClosingParagraph1",
  "ClosingParagraph2",
  "Signoff",
  "Signature",
] as const;

export type QuotationFieldKey = (typeof QUOTATION_FIELD_KEYS)[number];

export type QuotationStructuredData = Record<QuotationFieldKey, string | null>;

export interface QuotationAnalysisResult {
  structuredData: QuotationStructuredData;
  rawResponse: Record<string, unknown>;
}
