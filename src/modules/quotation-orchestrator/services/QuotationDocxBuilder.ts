import { Buffer } from "node:buffer";

import { BackendPythonModulesClient } from "../../document-intelligence/services/BackendPythonModulesClient.js";
import { QuotationStructuredData } from "../domain/QuotationStructuredData.js";

interface BuildQuotationDocxPayload {
  file_name?: unknown;
  content_type?: unknown;
  size_bytes?: unknown;
  docx_base64?: unknown;
}

export class QuotationDocxBuilder {
  private readonly pythonModulesClient: BackendPythonModulesClient;

  public constructor(pythonModulesClient?: BackendPythonModulesClient) {
    this.pythonModulesClient = pythonModulesClient ?? new BackendPythonModulesClient();
  }

  public async build(structuredData: QuotationStructuredData): Promise<Buffer> {
    const response = await this.pythonModulesClient.execute("docx_engine", "build_quotation_docx", {
      file_name: "preventivo.docx",
      structured_data: structuredData,
    });

    const payload = response.output && typeof response.output === "object"
      ? response.output as Record<string, unknown>
      : {};

    return this.decodeResponse(payload);
  }

  private decodeResponse(payload: Record<string, unknown>): Buffer {
    const output = payload as BuildQuotationDocxPayload;
    if (typeof output.docx_base64 !== "string" || !output.docx_base64.trim()) {
      throw new Error("python_modules docx_engine returned an invalid docx payload.");
    }

    const buffer = Buffer.from(output.docx_base64, "base64");
    if (buffer.byteLength === 0) {
      throw new Error("python_modules docx_engine returned an empty DOCX file.");
    }

    return buffer;
  }
}
