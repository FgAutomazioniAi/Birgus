import { Body, Controller, Get, HttpCode, Inject, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { MailProviderSettingsService } from "../../modules/mail-runtime/services/MailProviderSettingsService.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const mailProviderSettingsSchema = z.object({
  provider: z.enum(["smtp", "resend"]).optional(),
  from: z.string().trim().max(300).optional(),
  smtpHost: z.string().trim().max(300).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().trim().max(300).optional(),
  smtpPass: z.string().trim().max(500).optional(),
  resendApiKey: z.string().trim().max(500).optional(),
}).strict();

@Controller("/api/settings/mail-provider")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.NOTIFICATION_CENTER)
export class MailProviderSettingsController {
  public constructor(
    @Inject(MailProviderSettingsService)
    private readonly settingsService: MailProviderSettingsService,
  ) {}

  @Get()
  @RequirePermission(PermissionKey.NOTIFICATIONS_READ)
  public async getSettings(): Promise<Record<string, unknown>> {
    return { settings: await this.settingsService.getPublicSettings() };
  }

  @Patch()
  @HttpCode(200)
  @RequirePermission(PermissionKey.NOTIFICATIONS_WRITE)
  public async patchSettings(@Body() bodyRaw: unknown): Promise<Record<string, unknown>> {
    const body = mailProviderSettingsSchema.parse(bodyRaw ?? {});
    return { settings: await this.settingsService.saveSettings(body) };
  }

  @Post("validate")
  @HttpCode(200)
  @RequirePermission(PermissionKey.NOTIFICATIONS_WRITE)
  public async validate(@Body() bodyRaw: unknown): Promise<Record<string, unknown>> {
    const body = mailProviderSettingsSchema.parse(bodyRaw ?? {});
    return this.settingsService.validateSettings(body);
  }
}
