import { Body, Controller, Get, HttpCode, Inject, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { AiProviderSettingsService } from "../../modules/ai-runtime/services/AiProviderSettingsService.js";
import { BackendPythonModulesClient } from "../../modules/document-intelligence/services/BackendPythonModulesClient.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";

const aiProviderSettingsSchema = z.object({
  baseUrl: z.string().trim().min(1).max(300).optional(),
  chatModel: z.string().trim().min(1).max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  timeoutMs: z.number().int().min(1000).max(900000).optional(),
}).strict();

@Controller("/api/settings/ai-provider")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.CONVERSATIONAL_ASSISTANT)
export class AiProviderSettingsController {
  public constructor(
    @Inject(AiProviderSettingsService)
    private readonly settingsService: AiProviderSettingsService,
    @Inject(BackendPythonModulesClient)
    private readonly pythonModulesClient: BackendPythonModulesClient,
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
    return { models: await this.settingsService.discoverModels(body) };
  }

  @Post("validate")
  @HttpCode(200)
  public async validate(@Body() bodyRaw: unknown): Promise<Record<string, unknown>> {
    const body = aiProviderSettingsSchema.parse(bodyRaw ?? {});
    const config = await this.settingsService.getRuntimeConfig(body);
    try {
      const result = await this.pythonModulesClient.execute("langchain_orchestrator", "chat", {
        input_text: "Rispondi solo con OK.",
        ai_provider: {
          base_url: config.baseUrl,
          chat_model: config.chatModel,
          temperature: config.temperature,
          timeout_ms: config.timeoutMs,
        },
      });
      const output = result.output && typeof result.output === "object" ? result.output as Record<string, unknown> : {};
      return {
        ok: true,
        model: typeof output.model === "string" ? output.model : config.chatModel ?? null,
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        model: null,
        error: error instanceof Error ? error.message : "Validazione LangChain fallita.",
      };
    }
  }
}
