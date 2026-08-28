import { Body, Controller, Get, HttpCode, Inject, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { AI_PROVIDER_DEFINITIONS, MAX_AI_PROVIDER_OUTPUT_TOKENS } from "../../modules/ai-runtime/domain/AiProviderConfig.js";
import { AiProviderSettingsService } from "../../modules/ai-runtime/services/AiProviderSettingsService.js";
import { AiProviderError } from "../../modules/ai-runtime/domain/AiProviderError.js";
import { AppError } from "../../core/errors/AppError.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";

const aiProviderSettingsSchema = z.object({
  baseUrl: z.string().trim().min(1).max(300).optional(),
  chatModel: z.string().trim().min(1).max(200).optional(),
  provider: z.enum(AI_PROVIDER_DEFINITIONS.map((item) => item.id) as [string, ...string[]]).optional(),
  temperature: z.number().min(0).max(2).optional(),
  timeoutMs: z.number().int().min(1000).max(900000).optional(),
  maxOutputTokens: z.number().int().min(1).max(MAX_AI_PROVIDER_OUTPUT_TOKENS).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(-1).max(1000).optional(),
  minP: z.number().min(0).max(1).optional(),
  repetitionPenalty: z.number().min(0.1).max(2).optional(),
  seed: z.number().int().min(0).max(2147483647).nullable().optional(),
  contextTokenLimit: z.number().int().min(256).max(8192).nullable().optional(),
}).strict();

@Controller("/api/settings/ai-provider")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.CONVERSATIONAL_ASSISTANT)
export class AiProviderSettingsController {
  public constructor(
    @Inject(AiProviderSettingsService)
    private readonly settingsService: AiProviderSettingsService,
  ) {}

  @Get()
  public async getSettings(): Promise<Record<string, unknown>> {
    return { settings: await this.settingsService.getPublicSettings() };
  }

  @Patch()
  @HttpCode(200)
  public async patchSettings(@Body() bodyRaw: unknown): Promise<Record<string, unknown>> {
    const body = aiProviderSettingsSchema.parse(bodyRaw ?? {});
    return { settings: await this.settingsService.saveSettings(body) };
  }

  @Post("models")
  @HttpCode(200)
  public async loadModels(@Body() bodyRaw: unknown): Promise<Record<string, unknown>> {
    const body = aiProviderSettingsSchema.parse(bodyRaw ?? {});
    try {
      return { models: await this.settingsService.discoverModels(body) };
    } catch (error) {
      throw this.toRequestError(error);
    }
  }

  @Post("validate")
  @HttpCode(200)
  public async validate(@Body() bodyRaw: unknown): Promise<Record<string, unknown>> {
    const body = aiProviderSettingsSchema.parse(bodyRaw ?? {});
    const result = await this.settingsService.validateSettings(body);
    if (result.ok) {
      return result;
    }
    throw this.toRequestError(result.error);
  }

  private toRequestError(error: unknown): AppError {
    if (error instanceof AiProviderError) {
      return new AppError(error.code, error.code, error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? 400 : 502);
    }
    if (typeof error === "string" && error.startsWith("AI_PROVIDER_")) {
      return new AppError(error, error, 502);
    }
    return new AppError("AI_PROVIDER_REQUEST_FAILED", "AI_PROVIDER_REQUEST_FAILED", 502);
  }
}
