import nodemailer from "nodemailer";

import { AUTH_PASSWORD_RESET_CODE_TTL_MINUTES } from "@/lib/auth/constants";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM;

let cachedTransporter: nodemailer.Transporter | null = null;

const ensureSmtpConfigured = () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM || !Number.isFinite(SMTP_PORT)) {
    throw new Error("Configurazione SMTP incompleta nel file .env.");
  }
};

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  ensureSmtpConfigured();

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return cachedTransporter;
};

export async function sendPasswordResetCodeEmail(to: string, code: string) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Recupero password",
    text: [
      "Hai richiesto il recupero password per Birgus.",
      `Codice monouso: ${code}`,
      `Scadenza: ${AUTH_PASSWORD_RESET_CODE_TTL_MINUTES} minuti.`,
      "Se non hai fatto tu la richiesta, ignora questa email.",
    ].join("\n"),
  });
}
