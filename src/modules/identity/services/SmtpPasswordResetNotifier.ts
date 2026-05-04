import nodemailer, { Transporter } from "nodemailer";

import { AppError } from "../../../core/errors/AppError.js";
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

  public constructor() {
    this.config = this.readConfig();
  }

  public async sendResetCode(params: {
    email: string;
    firstName: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<void> {
    try {
      const transporter = this.getTransporter();
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

      await transporter.sendMail({
        from: this.config.from,
        to: params.email,
        subject,
        text,
      });
    } catch (error) {
      throw new AppError(
        "Invio email non riuscito. Avvisa il tuo amministratore oppure contatta support.ai@fgautomazioni.it.",
        "AUTH_PASSWORD_RESET_EMAIL_FAILED",
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
