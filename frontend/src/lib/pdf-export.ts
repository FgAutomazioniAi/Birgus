type PdfColumnAlign = "left" | "center" | "right";

export interface PdfTableColumn {
  align?: PdfColumnAlign;
  key: string;
  label: string;
}

export interface DownloadTablePdfInput {
  columns: PdfTableColumn[];
  filename: string;
  rows: Record<string, string | number | null | undefined>[];
  subtitle?: string;
  title: string;
}

const normalizeFilename = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "export.pdf";
  }

  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
};

const asText = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

export async function downloadTablePdf({
  columns,
  filename,
  rows,
  subtitle,
  title,
}: DownloadTablePdfInput): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule.default ??
    (autoTableModule as unknown as { autoTable?: (...args: unknown[]) => void }).autoTable) as
    | ((...args: unknown[]) => void)
    | undefined;

  if (!autoTable) {
    throw new Error("Impossibile inizializzare il generatore PDF.");
  }

  const orientation = columns.length > 5 ? "landscape" : "portrait";
  const doc = new jsPDF({ format: "a4", orientation, unit: "pt" });
  const generatedAt = new Date().toLocaleString("it-IT");

  doc.setFontSize(14);
  doc.text(title, 40, 38);
  doc.setFontSize(9);
  doc.setTextColor(110, 120, 130);
  doc.text(`Generato il ${generatedAt}`, 40, 54);

  if (subtitle?.trim()) {
    doc.text(subtitle.trim(), 40, 68);
  }

  const columnStyles = columns.reduce<Record<number, { halign: PdfColumnAlign }>>((accumulator, column, index) => {
    accumulator[index] = {
      halign: column.align ?? "left",
    };
    return accumulator;
  }, {});

  autoTable(doc, {
    body: rows.map((row) => columns.map((column) => asText(row[column.key]))),
    columnStyles,
    head: [columns.map((column) => column.label)],
    headStyles: {
      fillColor: [28, 63, 97],
      fontSize: 9,
      textColor: 255,
    },
    margin: { left: 40, right: 40 },
    startY: subtitle?.trim() ? 82 : 68,
    styles: {
      cellPadding: 5,
      fontSize: 8,
      lineColor: [225, 230, 235],
      lineWidth: 0.2,
      overflow: "linebreak",
      textColor: [35, 45, 55],
      valign: "middle",
    },
    theme: "grid",
  });

  doc.save(normalizeFilename(filename));
}
