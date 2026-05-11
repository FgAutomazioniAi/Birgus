export interface QuotationEmailNotifier {
  sendQuotation(params: {
    to: string;
    clientName: string | null;
    projectName: string | null;
    versionLabel: string;
    fileName: string;
    docxBytes: Buffer;
  }): Promise<void>;
}
