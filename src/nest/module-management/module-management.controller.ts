import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { ModuleManagementService } from "../../modules/module-management/services/ModuleManagementService.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const configureUserModuleSchema = z.object({
  reason: z.string().max(500).optional(),
});

const clearUserOverrideSchema = z.object({
  confirmText: z.string().min(1),
});

@Controller("/api/modules")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
export class NestModuleManagementController {
  public constructor(
    @Inject(ModuleManagementService)
    private readonly moduleManagementService: ModuleManagementService,
  ) {}

  @Get()
  @RequirePermission(PermissionKey.MODULES_READ)
  public async listWorkspaceModules(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const modules = await this.moduleManagementService.listWorkspaceModules(workspaceId);

    return {
      workspaceId,
      modules: modules.map((item) => ({ moduleKey: item.moduleKey, enabled: item.enabled })),
    };
  }

  @Post(":moduleKey/enable")
  @HttpCode(200)
  @RequirePermission(PermissionKey.MODULES_CONFIGURE)
  public async enableModule(
    @Param("moduleKey") moduleKeyRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const configuredByUserId = requestContext.workspace.userId;
    const moduleKey = this.getModuleKey(moduleKeyRaw);

    await this.moduleManagementService.enableModule(workspaceId, moduleKey, configuredByUserId);
    return { ok: true, workspaceId, moduleKey, enabled: true };
  }

  @Post(":moduleKey/disable")
  @HttpCode(200)
  @RequirePermission(PermissionKey.MODULES_CONFIGURE)
  public async disableModule(
    @Param("moduleKey") moduleKeyRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const configuredByUserId = requestContext.workspace.userId;
    const moduleKey = this.getModuleKey(moduleKeyRaw);

    await this.moduleManagementService.disableModule(workspaceId, moduleKey, configuredByUserId);
    return { ok: true, workspaceId, moduleKey, enabled: false };
  }

  @Get("users/:userId")
  @RequirePermission(PermissionKey.MODULES_READ)
  public async listUserModules(
    @Param("userId") userIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = this.getUserId(userIdRaw);
    const modules = await this.moduleManagementService.listUserModules(workspaceId, userId);

    return {
      workspaceId,
      userId,
      modules: modules.map((item) => ({
        moduleKey: item.moduleKey,
        workspaceEnabled: item.workspaceEnabled,
        overrideMode: item.overrideMode,
        effectiveEnabled: item.effectiveEnabled,
      })),
    };
  }

  @Post("users/:userId/:moduleKey/allow")
  @HttpCode(200)
  @RequirePermission(PermissionKey.MODULES_CONFIGURE)
  public async allowModuleForUser(
    @Param("userId") userIdRaw: string,
    @Param("moduleKey") moduleKeyRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const payload = configureUserModuleSchema.parse(bodyRaw ?? {});
    const workspaceId = requestContext.workspace.workspaceId;
    const configuredByUserId = requestContext.workspace.userId;
    const userId = this.getUserId(userIdRaw);
    const moduleKey = this.getModuleKey(moduleKeyRaw);

    await this.moduleManagementService.allowModuleForUser(
      workspaceId,
      userId,
      moduleKey,
      configuredByUserId,
      payload.reason ?? null,
    );

    return { ok: true, workspaceId, userId, moduleKey, overrideMode: "ALLOW" };
  }

  @Post("users/:userId/:moduleKey/deny")
  @HttpCode(200)
  @RequirePermission(PermissionKey.MODULES_CONFIGURE)
  public async denyModuleForUser(
    @Param("userId") userIdRaw: string,
    @Param("moduleKey") moduleKeyRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const payload = configureUserModuleSchema.parse(bodyRaw ?? {});
    const workspaceId = requestContext.workspace.workspaceId;
    const configuredByUserId = requestContext.workspace.userId;
    const userId = this.getUserId(userIdRaw);
    const moduleKey = this.getModuleKey(moduleKeyRaw);

    await this.moduleManagementService.denyModuleForUser(
      workspaceId,
      userId,
      moduleKey,
      configuredByUserId,
      payload.reason ?? null,
    );

    return { ok: true, workspaceId, userId, moduleKey, overrideMode: "DENY" };
  }

  @Delete("users/:userId/:moduleKey/override")
  @HttpCode(200)
  @RequirePermission(PermissionKey.MODULES_CONFIGURE)
  public async clearUserOverride(
    @Param("userId") userIdRaw: string,
    @Param("moduleKey") moduleKeyRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = clearUserOverrideSchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const workspaceId = requestContext.workspace.workspaceId;
    const userId = this.getUserId(userIdRaw);
    const moduleKey = this.getModuleKey(moduleKeyRaw);

    await this.moduleManagementService.clearUserOverride(workspaceId, userId, moduleKey);
    return { ok: true, workspaceId, userId, moduleKey, overrideMode: null };
  }

  private getUserId(value: string): string {
    if (!value || !value.trim()) {
      throw new AppError("User ID is required.", "USER_ID_REQUIRED", 400);
    }

    return value.trim();
  }

  private getModuleKey(raw: string): string {
    if (!raw || !raw.trim()) {
      throw new AppError("Module key is required.", "MODULE_KEY_REQUIRED", 400);
    }

    return raw.trim();
  }
}
