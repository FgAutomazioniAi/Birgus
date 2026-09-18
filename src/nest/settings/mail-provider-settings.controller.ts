import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { MailProviderSettingsService } from "../../modules/mail-runtime/services/MailProviderSettingsService.js";
import { PermissionPolicy } from "../../core/authorization/PermissionPolicy.js";
import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const mailProviderSettingsSchema = z
  .object({
    provider: z.enum(["smtp", "resend"]).optional(),
    from: z.string().trim().max(300).optional(),
    smtpHost: z.string().trim().max(300).optional(),
    smtpPort: z.number().int().min(1).max(65535).optional(),
    smtpSecure: z.boolean().optional(),
    smtpUser: z.string().trim().max(300).optional(),
    smtpPass: z.string().trim().max(500).optional(),
    resendApiKey: z.string().trim().max(500).optional(),
  })
  .strict();

const providerPermission: Record<string, string> = {
  smtp: PermissionKey.EMAIL_SMTP,
  resend: PermissionKey.EMAIL_RESEND,
};

@Controller("/api/settings/mail-provider")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.NOTIFICATION_CENTER)
export class MailProviderSettingsController {
  public constructor(
    @Inject(MailProviderSettingsService)
    private readonly settingsService: MailProviderSettingsService,
    @Inject(PermissionPolicy)
    private readonly permissionPolicy: PermissionPolicy,
    @Inject(AuditLogService)
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  @RequirePermission(PermissionKey.NOTIFICATIONS_READ)
  public async getSettings(
    @CurrentRequestContext() context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = context.workspace.workspaceId;
    const userId = context.workspace.userId;
    const providerKeys = await Promise.all(
      Object.entries(providerPermission).map(
        async ([provider, permission]) => ({
          provider,
          allowed: await this.permissionPolicy.hasPermission(
            workspaceId,
            userId,
            permission,
          ),
        }),
      ),
    );
    return {
      settings: await this.settingsService.getPublicSettings(),
      allowedProviders: providerKeys
        .filter((item) => item.allowed)
        .map((item) => item.provider),
    };
  }

  @Patch()
  @HttpCode(200)
  @RequirePermission(PermissionKey.NOTIFICATIONS_WRITE)
  public async patchSettings(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = mailProviderSettingsSchema.parse(bodyRaw ?? {});
    await this.ensureProviderPermission(body.provider, context);
    const settings = await this.settingsService.saveSettings(body);
    await this.auditLogService.record({
      workspaceId: context.workspace.workspaceId,
      userId: context.workspace.userId,
      moduleKey: ModuleKey.NOTIFICATION_CENTER,
      action: "settings.mail_provider.updated",
      entityType: "MailProviderSettings",
      payload: {
        changedFields: Object.keys(body).filter(
          (key) => !["smtpPass", "resendApiKey"].includes(key),
        ),
      },
    });
    return { settings };
  }

  @Post("validate")
  @HttpCode(200)
  @RequirePermission(PermissionKey.NOTIFICATIONS_WRITE)
  public async validate(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = mailProviderSettingsSchema.parse(bodyRaw ?? {});
    await this.ensureProviderPermission(body.provider, context);
    return this.settingsService.validateSettings(body);
  }

  private async ensureProviderPermission(
    provider: string | undefined,
    context: RequestContext,
  ): Promise<void> {
    if (!provider) return;
    const permission = providerPermission[provider];
    if (permission) {
      await this.permissionPolicy.ensureAllowed(
        context.workspace.workspaceId,
        context.workspace.userId,
        permission,
      );
    }
  }
}
