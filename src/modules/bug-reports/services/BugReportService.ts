import nodemailer from "nodemailer";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { AppError } from "../../../core/errors/AppError.js";
import { MailProviderSettingsService } from "../../mail-runtime/services/MailProviderSettingsService.js";

@Injectable()
export class BugReportService {
  private readonly logger = new Logger(BugReportService.name);

  public constructor(
    @Inject(MailProviderSettingsService)
    private readonly mailSettings: MailProviderSettingsService,
  ) {}

  public async submit(params: {
    title: string;
    description: string;
    userName: string;
    userEmail: string;
    workspaceName: string;
    pageUrl: string;
  }): Promise<void> {
    const recipient = process.env.BUG_REPORT_EMAIL?.trim();
    if (!recipient)
      throw new AppError(
        "Destinatario delle segnalazioni bug non configurato.",
        "BUG_REPORT_RECIPIENT_MISSING",
        503,
      );
    const config = await this.mailSettings.getRuntimeConfig();
    const subject = `[Birgus bug] ${params.title}`;
    const text = [
      `Argomento: ${params.title}`,
      "",
      `Problema:\n${params.description}`,
      "",
      `Utente: ${params.userName} <${params.userEmail}>`,
      `Workspace: ${params.workspaceName}`,
      `Pagina: ${params.pageUrl || "non disponibile"}`,
      `Data: ${new Date().toISOString()}`,
    ].join("\n");

    try {
      if (config.provider === "resend") {
        if (!config.resendApiKey || !config.from)
          throw new Error("Configurazione Resend incompleta.");
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to: [recipient],
            subject,
            text,
          }),
        });
        if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
        return;
      }

      const auth =
        config.smtpUser && config.smtpPass
          ? { user: config.smtpUser, pass: config.smtpPass }
          : undefined;
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth,
      });
      await transporter.sendMail({
        from: config.from,
        to: recipient,
        subject,
        text,
        replyTo: params.userEmail,
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.logger.error(`Bug report delivery failed: ${details}`);
      throw new AppError(
        "Invio della segnalazione non riuscito.",
        "BUG_REPORT_DELIVERY_FAILED",
        503,
      );
    }
  }
}
