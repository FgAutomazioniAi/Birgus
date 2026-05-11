import nodemailer, { Transporter } from "nodemailer";

import { AppError } from "../../../core/errors/AppError.js";
import { QuotationEmailNotifier } from "./QuotationEmailNotifier.js";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export class SmtpQuotationEmailNotifier implements QuotationEmailNotifier {
  private readonly config: SmtpConfig;
  private transporter: Transporter | null = null;

  public constructor() {
    this.config = this.readConfig();
  }

  public async sendQuotation(params: {
    to: string;
    clientName: string | null;
    projectName: string | null;
    versionLabel: string;
    fileName: string;
    docxBytes: Buffer;
  }): Promise<void> {
    const transporter = this.getTransporter();
    const safeProjectName = params.projectName?.trim() || "il progetto richiesto";
    const greetingName = params.clientName?.trim() || "cliente";
    const subject = `Preventivo ${safeProjectName} ${params.versionLabel}`.trim();
    const text = [
      `Ciao ${greetingName},`,
      "",
      `in allegato trovi il preventivo DOCX relativo a ${safeProjectName}, versione ${params.versionLabel}.`,
      "",
      "Il documento e' stato generato automaticamente da Birgus.",
      "",
      "Cordiali saluti,",
      "Birgus",
    ].join("\n");

    try {
      await transporter.sendMail({
        from: this.config.from,
        to: params.to,
        subject,
        text,
        attachments: [
          {
            filename: params.fileName,
            content: params.docxBytes,
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        ],
      });
    } catch {
      throw new AppError(
        "Invio email del preventivo non riuscito.",
        "QUOTATION_EMAIL_SEND_FAILED",
        503,
      );
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    return this.transporter;
  }

  private readConfig(): SmtpConfig {
    const host = this.readRequired("SMTP_HOST");
    const from = this.readRequired("SMTP_FROM");
    const user = this.readRequired("SMTP_USER");
    const pass = this.readRequired("SMTP_PASS");

    const portRaw = process.env.SMTP_PORT?.trim() || "587";
    const port = Number.parseInt(portRaw, 10);
    if (!Number.isFinite(port) || port <= 0) {
      throw new AppError("SMTP_PORT non valido.", "SMTP_PORT_INVALID", 500);
    }

    const secureRaw = process.env.SMTP_SECURE?.trim().toLowerCase() || "false";
    const secure = secureRaw === "1" || secureRaw === "true" || secureRaw === "yes" || secureRaw === "on";

    return {
      host,
      from,
      user,
      pass,
      port,
      secure,
    };
  }

  private readRequired(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new AppError(
        `Configurazione SMTP mancante: ${name}.`,
        "SMTP_CONFIG_MISSING",
        500,
      );
    }

    return value;
  }
}
