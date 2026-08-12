export const MEASURE_REPORT_DOCUMENT_TYPES = [
  "auto",
  "zeiss_1",
  "zeiss_2",
  "vicivision",
  "dea",
] as const;

export type MeasureReportDocumentType = (typeof MEASURE_REPORT_DOCUMENT_TYPES)[number];

export const MEASURE_REPORT_DOCUMENT_TYPE_LABELS: Record<MeasureReportDocumentType, string> = {
  auto: "Auto",
  zeiss_1: "Zeiss 1",
  zeiss_2: "Zeiss 2",
  vicivision: "Vicivision",
  dea: "DEA",
};

export function normalizeMeasureReportDocumentType(value: string | null | undefined): MeasureReportDocumentType {
  if (!value) {
    return "auto";
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, MeasureReportDocumentType> = {
    zeiss: "zeiss_1",
    zeiss1: "zeiss_1",
    zeiss_01: "zeiss_1",
    zeiss2: "zeiss_2",
    zeiss_02: "zeiss_2",
    vici: "vicivision",
  };

  const candidate = aliases[normalized] ?? normalized;
  if (MEASURE_REPORT_DOCUMENT_TYPES.includes(candidate as MeasureReportDocumentType)) {
    return candidate as MeasureReportDocumentType;
  }

  return "auto";
}

export function inferMeasureReportDocumentTypeFromFilename(fileName: string | null | undefined): MeasureReportDocumentType {
  const lower = (fileName ?? "").trim().toLowerCase();
  if (!lower) {
    return "auto";
  }

  if (lower.includes("zeiss_1") || lower.includes("zeiss1")) {
    return "zeiss_1";
  }
  if (lower.includes("zeiss_2") || lower.includes("zeiss2")) {
    return "zeiss_2";
  }
  if (lower.includes("vicivision") || lower.includes("vici")) {
    return "vicivision";
  }
  if (lower.includes("dea")) {
    return "dea";
  }

  return "auto";
}

export function resolveMeasureReportEffectiveDocumentType(
  requestedType: string | null | undefined,
  fileName: string | null | undefined,
): Exclude<MeasureReportDocumentType, "auto"> {
  const normalized = normalizeMeasureReportDocumentType(requestedType);
  if (normalized !== "auto") {
    return normalized;
  }

  const inferred = inferMeasureReportDocumentTypeFromFilename(fileName);
  if (inferred !== "auto") {
    return inferred;
  }

  return "zeiss_1";
}

