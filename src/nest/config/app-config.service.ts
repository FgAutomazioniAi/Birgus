import { Injectable } from "@nestjs/common";

@Injectable()
export class AppConfigService {
  public constructor() {
    this.assertProductionReady();
  }

  public getString(key: string, fallback = ""): string {
    const value = process.env[key];
    return typeof value === "string" && value.length > 0 ? value : fallback;
  }

  public getOptionalString(key: string): string | null {
    const value = process.env[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  public getNumber(key: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[key] ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  public getTrustProxy(): boolean | string | number | string[] {
    const raw = (process.env.TRUST_PROXY ?? "").trim();
    if (!raw) {
      return false;
    }

    if (raw === "true") {
      return true;
    }

    if (raw === "false") {
      return false;
    }

    const parsedNumber = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsedNumber) && String(parsedNumber) === raw) {
      return parsedNumber;
    }

    if (raw.includes(",")) {
      return raw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    }

    return raw;
  }

  public getNestHost(): string {
    return this.getString("NEST_HOST", this.getString("HOST", "0.0.0.0"));
  }

  public getNestPort(): number {
    return this.getNumber("NEST_PORT", this.getNumber("PORT", 3000));
  }

  private assertProductionReady(): void {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    const requiredKeys = [
      "DATABASE_URL",
      "AUTH_PEPPER",
      "AUTH_TOTP_ENCRYPTION_KEY",
      "GARAGE_S3_BUCKET",
      "GARAGE_S3_ACCESS_KEY_ID",
      "GARAGE_S3_SECRET_ACCESS_KEY",
      "MEASURE_REPORT_LM_BASE_URL",
      "MEASURE_REPORT_LM_MODEL",
    ];
    const missingKeys = requiredKeys.filter((key) => !this.getString(key).trim());
    const mailProvider = this.getString("MAIL_PROVIDER", "smtp").trim().toLowerCase();
    if (mailProvider === "resend") {
      for (const key of ["RESEND_API_KEY", "MAIL_FROM"]) {
        if (!this.getString(key).trim()) {
          missingKeys.push(key);
        }
      }
    } else {
      for (const key of ["SMTP_HOST", "SMTP_FROM"]) {
        if (!this.getString(key).trim()) {
          missingKeys.push(key);
        }
      }
    }
    const hasAiProviderConfig = this.getString("AI_PROVIDER_BASE_URL").trim() && this.getString("AI_PROVIDER_CHAT_MODEL").trim();
    const hasLegacyLmConfig = this.getString("ORCH_LM_BASE_URL").trim() && this.getString("ORCH_LM_MODEL").trim();
    if (!hasAiProviderConfig && !hasLegacyLmConfig) {
      missingKeys.push("AI_PROVIDER_BASE_URL/AI_PROVIDER_CHAT_MODEL or ORCH_LM_BASE_URL/ORCH_LM_MODEL");
    }
    if (missingKeys.length > 0) {
      throw new Error(`Missing required production environment variables: ${missingKeys.join(", ")}`);
    }

    if (this.getString("AUTH_COOKIE_SECURE", "true").trim().toLowerCase() === "false") {
      throw new Error("AUTH_COOKIE_SECURE must not be false in production.");
    }
  }
}
