export class FileKind {
  public static readonly EMAIL_PDF = "email-pdf";
  public static readonly QUOTATION_DOCX = "quotation-docx";
  public static readonly QUOTATION_PDF = "quotation-pdf";
  public static readonly QUOTATION_XLSX = "quotation-xlsx";
  public static readonly TECH_PDF = "tech-pdf";

  public static readonly ALL = [
    FileKind.EMAIL_PDF,
    FileKind.QUOTATION_DOCX,
    FileKind.QUOTATION_PDF,
    FileKind.QUOTATION_XLSX,
    FileKind.TECH_PDF,
  ] as const;
}

export type FileKindValue = (typeof FileKind.ALL)[number];
