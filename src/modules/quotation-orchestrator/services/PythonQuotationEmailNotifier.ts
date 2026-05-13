import { AppError } from "../../../core/errors/AppError.js";
import { BackendPythonModulesClient } from "../../document-intelligence/services/BackendPythonModulesClient.js";
import { QuotationEmailNotifier } from "./QuotationEmailNotifier.js";

export class PythonQuotationEmailNotifier implements QuotationEmailNotifier {
  private readonly pythonModulesClient: BackendPythonModulesClient;

  public constructor(pythonModulesClient?: BackendPythonModulesClient) {
    this.pythonModulesClient = pythonModulesClient ?? new BackendPythonModulesClient();
  }

  public async sendQuotation(params: {
    to: string;
    clientName: string | null;
    projectName: string | null;
    versionLabel: string;
    fileName: string;
    docxBytes: Buffer;
  }): Promise<void> {
    try {
      await this.pythonModulesClient.execute("mail_engine", "send_quotation_email", {
        to: params.to,
        client_name: params.clientName,
        project_name: params.projectName,
        version_label: params.versionLabel,
        file_name: params.fileName,
        docx_base64: params.docxBytes.toString("base64"),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "python mail engine unavailable";
      throw new AppError(
        `Invio email del preventivo non riuscito: ${detail}`,
        "QUOTATION_EMAIL_SEND_FAILED",
        503,
      );
    }
  }
}
