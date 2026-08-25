import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../nest/prisma/prisma.service.js";
import { AI_PROVIDER_DEFINITIONS, loadAiProviderConfig, normalizeAiProviderId, type AiProviderConfig } from "../domain/AiProviderConfig.js";
import type { AiModelItem } from "../domain/AiChatResponse.js";
import { OpenAiCompatibleLmClient } from "./OpenAiCompatibleLmClient.js";

const AI_PROVIDER_SETTING_KEY = "ai_provider";

export interface AiProviderSettingsPatch {
  baseUrl?: string;
  chatModel?: string;
  provider?: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface PublicAiProviderSettings {
  availableProviders: typeof AI_PROVIDER_DEFINITIONS;
  baseUrl: string;
  chatModel: string;
  provider: string;
  source: "database" | "environment";
  temperature: number;
  timeoutMs: number;
}

type StoredAiProviderSettings = Partial<AiProviderConfig>;

export class AiProviderSettingsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getRuntimeConfig(patch?: AiProviderSettingsPatch): Promise<Partial<AiProviderConfig>> {
    return this.buildEffectiveConfig(patch);
  }

  public async getPublicSettings(): Promise<PublicAiProviderSettings> {
    const stored = await this.getStoredSettings();
    const effective = {
      ...loadAiProviderConfig(),
      ...this.sanitizeStoredSettings(stored),
    };

    return {
      baseUrl: effective.baseUrl,
      chatModel: effective.chatModel,
      availableProviders: AI_PROVIDER_DEFINITIONS,
      provider: normalizeAiProviderId(effective.provider),
      source: stored ? "database" : "environment",
      temperature: effective.temperature,
      timeoutMs: effective.timeoutMs,
    };
  }

  public async saveSettings(patch: AiProviderSettingsPatch): Promise<PublicAiProviderSettings> {
    const previous = this.sanitizeStoredSettings(await this.getStoredSettings());
    const next: StoredAiProviderSettings = {
      ...previous,
      ...this.normalizePatch(patch),
    };

    await this.prisma.appSetting.upsert({
      where: { key: AI_PROVIDER_SETTING_KEY },
      create: {
        key: AI_PROVIDER_SETTING_KEY,
        value: next as Prisma.InputJsonObject,
      },
      update: {
        value: next as Prisma.InputJsonObject,
      },
    });

    return this.getPublicSettings();
  }

  public async discoverModels(patch: AiProviderSettingsPatch): Promise<AiModelItem[]> {
    const client = await this.buildOneShotClient(patch);
    return client.discoverModelsStrict();
  }

  public async validateSettings(patch: AiProviderSettingsPatch): Promise<{ ok: boolean; model: string | null; error: string | null }> {
    const client = await this.buildOneShotClient(patch);
    try {
      const validation = await client.chat("Rispondi solo con OK.");
      return { ok: true, model: validation.model, error: null };
    } catch (error) {
      return {
        ok: false,
        model: null,
        error: error instanceof Error ? error.message : "AI provider validation failed",
      };
    }
  }

  private async buildOneShotClient(patch: AiProviderSettingsPatch): Promise<OpenAiCompatibleLmClient> {
    const effective = await this.buildEffectiveConfig(patch);

    return new OpenAiCompatibleLmClient({
      apiKey: effective.apiKey,
      baseUrl: effective.baseUrl,
      completionsPath: effective.completionsPath,
      modelsPath: effective.modelsPath,
      requestedModel: effective.chatModel,
      temperature: effective.temperature,
      timeoutMs: effective.timeoutMs,
      useRuntimeConfig: false,
    });
  }

  private async buildEffectiveConfig(patch?: AiProviderSettingsPatch): Promise<AiProviderConfig> {
    return {
      ...loadAiProviderConfig(),
      ...this.sanitizeStoredSettings(await this.getStoredSettings()),
      ...this.normalizePatch(patch ?? {}),
    };
  }

  private normalizePatch(patch: AiProviderSettingsPatch): StoredAiProviderSettings {
    return this.compactSettings({
      provider: patch.provider ? normalizeAiProviderId(patch.provider) : undefined,
      baseUrl: this.trimString(patch.baseUrl),
      chatModel: this.trimString(patch.chatModel),
      temperature: typeof patch.temperature === "number" && Number.isFinite(patch.temperature) ? patch.temperature : undefined,
      timeoutMs: typeof patch.timeoutMs === "number" && Number.isFinite(patch.timeoutMs) && patch.timeoutMs > 0 ? Math.trunc(patch.timeoutMs) : undefined,
    });
  }

  private sanitizeStoredSettings(value: unknown): StoredAiProviderSettings {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const row = value as Record<string, unknown>;
    return this.compactSettings({
      provider: typeof row.provider === "string" ? normalizeAiProviderId(row.provider) : undefined,
      baseUrl: this.trimString(row.baseUrl),
      chatModel: this.trimString(row.chatModel),
      temperature: typeof row.temperature === "number" && Number.isFinite(row.temperature) ? row.temperature : undefined,
      timeoutMs: typeof row.timeoutMs === "number" && Number.isFinite(row.timeoutMs) && row.timeoutMs > 0 ? Math.trunc(row.timeoutMs) : undefined,
    });
  }

  private async getStoredSettings(): Promise<unknown | null> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: AI_PROVIDER_SETTING_KEY },
    });

    return row?.value ?? null;
  }

  private trimString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  }

  private compactSettings(settings: StoredAiProviderSettings): StoredAiProviderSettings {
    return Object.fromEntries(
      Object.entries(settings).filter(([, value]) => value !== undefined),
    ) as StoredAiProviderSettings;
  }
}
