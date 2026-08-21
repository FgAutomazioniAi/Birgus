import nodemailer, { Transporter } from "nodemailer";

import { AppError } from "../../../core/errors/AppError.js";
import { MailProviderSettingsService, type MailProviderRuntimeConfig } from "../../mail-runtime/services/MailProviderSettingsService.js";
import { PasswordResetNotifier } from "./PasswordResetNotifier.js";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export class SmtpPasswordResetNotifier implements PasswordResetNotifier {
  private readonly config: SmtpConfig;
  private transporter: Transporter | null = null;

  public constructor(private readonly mailProviderSettingsService?: MailProviderSettingsService | null) {
    this.config = this.readConfig();
  }

  public async sendResetCode(params: {
    email: string;
    firstName: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<void> {
    try {
      const subject = "Recupero password Birgus";
      const text = [
        `Ciao ${params.firstName || "utente"},`,
        "",
        "hai richiesto il recupero password per Birgus.",
        `Codice monouso: ${params.code}`,
        `Scadenza: ${params.expiresInMinutes} minuti.`,
        "",
        "Se non hai fatto tu la richiesta, ignora questa email.",
      ].join("\n");

      if (this.mailProviderSettingsService) {
        await this.sendWithRuntimeProvider(await this.mailProviderSettingsService.getRuntimeConfig(), {
          to: params.email,
          subject,
          text,
        });
        return;
      }

      await this.getTransporter().sendMail({ from: this.config.from, to: params.email, subject, text });
    } catch (error) {
      throw new AppError(
        "Invio email non riuscito. Avvisa il tuo amministratore oppure contatta support.ai@fgautomazioni.it.",
        "AUTH_PASSWORD_RESET_EMAIL_FAILED",
        503,
      );
    }
  }

  private async sendWithRuntimeProvider(
    config: MailProviderRuntimeConfig,
    params: { to: string; subject: string; text: string },
  ): Promise<void> {
    if (config.provider === "resend") {
      await this.sendWithResend(config, params);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser && config.smtpPass
        ? {
            user: config.smtpUser,
            pass: config.smtpPass,
          }
        : undefined,
    });

    await transporter.sendMail({
      from: config.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
  }

  private async sendWithResend(
    config: MailProviderRuntimeConfig,
    params: { to: string; subject: string; text: string },
  ): Promise<void> {
    if (!config.resendApiKey || !config.from) {
      throw new Error("Configurazione Resend incompleta.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend HTTP ${response.status}`);
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    if (!this.config.host || !this.config.from) {
      throw new AppError("Configurazione SMTP mancante.", "SMTP_CONFIG_MISSING", 500);
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
    const host = this.readOptional("SMTP_HOST");
    const from = this.readOptional("SMTP_FROM") || this.readOptional("MAIL_FROM");
    const user = this.readOptional("SMTP_USER");
    const pass = this.readOptional("SMTP_PASS");

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

  private readOptional(name: string): string {
    return process.env[name]?.trim() ?? "";
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
