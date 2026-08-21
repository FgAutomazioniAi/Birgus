import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../nest/prisma/prisma.service.js";

const MAIL_PROVIDER_SETTING_KEY = "mail_provider";

export type MailProviderKind = "smtp" | "resend";

export interface MailProviderSettingsPatch {
  provider?: MailProviderKind;
  from?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  resendApiKey?: string;
}

export interface MailProviderRuntimeConfig {
  provider: MailProviderKind;
  from: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  resendApiKey: string;
}

export interface PublicMailProviderSettings {
  provider: MailProviderKind;
  from: string;
  source: "database" | "environment";
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpConfigured: boolean;
  resendConfigured: boolean;
}

type StoredMailProviderSettings = Partial<MailProviderRuntimeConfig>;

export class MailProviderSettingsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getRuntimeConfig(patch?: MailProviderSettingsPatch): Promise<MailProviderRuntimeConfig> {
    return this.buildEffectiveConfig(patch);
  }

  public async getPublicSettings(): Promise<PublicMailProviderSettings> {
    const stored = await this.getStoredSettings();
    return this.toPublicSettings(await this.buildEffectiveConfig(), Boolean(stored));
  }

  public async saveSettings(patch: MailProviderSettingsPatch): Promise<PublicMailProviderSettings> {
    const previous = this.sanitizeStoredSettings(await this.getStoredSettings());
    const next = this.compactSettings({
      ...previous,
      ...this.normalizePatch(patch),
    });

    await this.prisma.appSetting.upsert({
      where: { key: MAIL_PROVIDER_SETTING_KEY },
      create: {
        key: MAIL_PROVIDER_SETTING_KEY,
        value: next as Prisma.InputJsonObject,
      },
      update: {
        value: next as Prisma.InputJsonObject,
      },
    });

    return this.getPublicSettings();
  }

  public async validateSettings(patch: MailProviderSettingsPatch): Promise<{ ok: boolean; error: string | null }> {
    const config = await this.buildEffectiveConfig(patch);
    const error = this.validateConfig(config);
    return { ok: error === null, error };
  }

  private async buildEffectiveConfig(patch?: MailProviderSettingsPatch): Promise<MailProviderRuntimeConfig> {
    return {
      ...this.loadFromEnv(),
      ...this.sanitizeStoredSettings(await this.getStoredSettings()),
      ...this.normalizePatch(patch ?? {}),
    };
  }

  private loadFromEnv(): MailProviderRuntimeConfig {
    return {
      provider: this.normalizeProvider(process.env.MAIL_PROVIDER) ?? "smtp",
      from: this.firstNonEmpty(process.env.MAIL_FROM, process.env.SMTP_FROM),
      smtpHost: this.firstNonEmpty(process.env.SMTP_HOST),
      smtpPort: this.toPositiveInt(process.env.SMTP_PORT, 587),
      smtpSecure: this.toBoolean(process.env.SMTP_SECURE, false),
      smtpUser: this.firstNonEmpty(process.env.SMTP_USER),
      smtpPass: this.firstNonEmpty(process.env.SMTP_PASS),
      resendApiKey: this.firstNonEmpty(process.env.RESEND_API_KEY),
    };
  }

  private toPublicSettings(config: MailProviderRuntimeConfig, hasStoredSettings: boolean): PublicMailProviderSettings {
    return {
      provider: config.provider,
      from: config.from,
      source: hasStoredSettings ? "database" : "environment",
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      smtpUser: config.smtpUser,
      smtpConfigured: Boolean(config.smtpHost && config.from),
      resendConfigured: Boolean(config.resendApiKey && config.from),
    };
  }

  private validateConfig(config: MailProviderRuntimeConfig): string | null {
    if (!config.from) {
      return "Mittente email mancante.";
    }
    if (config.provider === "smtp" && !config.smtpHost) {
      return "SMTP host mancante.";
    }
    if (config.provider === "resend" && !config.resendApiKey) {
      return "Resend API key mancante.";
    }
    return null;
  }

  private normalizePatch(patch: MailProviderSettingsPatch): StoredMailProviderSettings {
    return this.compactSettings({
      provider: this.normalizeProvider(patch.provider),
      from: this.trimString(patch.from),
      smtpHost: this.trimString(patch.smtpHost),
      smtpPort: typeof patch.smtpPort === "number" && Number.isFinite(patch.smtpPort) && patch.smtpPort > 0
        ? Math.trunc(patch.smtpPort)
        : undefined,
      smtpSecure: typeof patch.smtpSecure === "boolean" ? patch.smtpSecure : undefined,
      smtpUser: this.trimString(patch.smtpUser),
      smtpPass: this.trimString(patch.smtpPass),
      resendApiKey: this.trimString(patch.resendApiKey),
    });
  }

  private sanitizeStoredSettings(value: unknown): StoredMailProviderSettings {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const row = value as Record<string, unknown>;
    return this.compactSettings({
      provider: this.normalizeProvider(row.provider),
      from: this.trimString(row.from),
      smtpHost: this.trimString(row.smtpHost),
      smtpPort: typeof row.smtpPort === "number" && Number.isFinite(row.smtpPort) && row.smtpPort > 0
        ? Math.trunc(row.smtpPort)
        : undefined,
      smtpSecure: typeof row.smtpSecure === "boolean" ? row.smtpSecure : undefined,
      smtpUser: this.trimString(row.smtpUser),
      smtpPass: this.trimString(row.smtpPass),
      resendApiKey: this.trimString(row.resendApiKey),
    });
  }

  private async getStoredSettings(): Promise<unknown | null> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: MAIL_PROVIDER_SETTING_KEY },
    });

    return row?.value ?? null;
  }

  private normalizeProvider(value: unknown): MailProviderKind | undefined {
    return value === "smtp" || value === "resend" ? value : undefined;
  }

  private trimString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  }

  private firstNonEmpty(...values: Array<string | undefined>): string {
    for (const value of values) {
      const normalized = value?.trim();
      if (normalized) {
        return normalized;
      }
    }
    return "";
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private toBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value?.trim()) {
      return fallback;
    }
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }

  private compactSettings(settings: StoredMailProviderSettings): StoredMailProviderSettings {
    return Object.fromEntries(
      Object.entries(settings).filter(([, value]) => value !== undefined),
    ) as StoredMailProviderSettings;
  }
}
