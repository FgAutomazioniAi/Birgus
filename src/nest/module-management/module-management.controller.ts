import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { ModuleManagementService } from "../../modules/module-management/services/ModuleManagementService.js";
import { BackendPythonModulesClient } from "../../modules/document-intelligence/services/BackendPythonModulesClient.js";
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
    @Inject(BackendPythonModulesClient)
    private readonly pythonModulesClient: BackendPythonModulesClient,
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

  @Get("workspace-settings")
  @RequirePermission(PermissionKey.MODULES_CONFIGURE)
  public async listWorkspaceModulesForConfiguration(
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

    if (moduleKey === "ddt_processing") {
      await this.startOcrRuntime();
    }
    await this.moduleManagementService.enableModule(workspaceId, moduleKey, configuredByUserId);
    return {
      ok: true,
      workspaceId,
      moduleKey,
      enabled: true,
      ocrRuntime: moduleKey === "ddt_processing" ? { running: true, error: null } : null,
    };
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
    const ocrRuntime = moduleKey === "ddt_processing"
      ? await this.stopOcrRuntime()
      : null;
    return { ok: true, workspaceId, moduleKey, enabled: false, ocrRuntime };
  }

  @Get("ddt_processing/runtime")
  @RequirePermission(PermissionKey.MODULES_CONFIGURE)
  public async getOcrRuntimeStatus(): Promise<Record<string, unknown>> {
    try {
      return await this.pythonModulesClient.getOcrRuntimeStatus();
    } catch (error) {
      return {
        containerRunning: false,
        state: "failed",
        modelLoaded: false,
        error: error instanceof Error ? error.message : "OCR runtime status unavailable",
      };
    }
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

  private async startOcrRuntime(): Promise<void> {
    try {
      const result = await this.pythonModulesClient.startOcrContainer();
      if (!result.running) {
        throw new Error("OCR container did not start");
      }
    } catch (error) {
      throw new AppError(
        "Unable to start OCR container. Check the OCR lifecycle service and Docker.",
        "OCR_CONTAINER_START_FAILED",
        503,
      );
    }
  }

  private async stopOcrRuntime(): Promise<{ running: boolean; shared: boolean; error: string | null }> {
    if (await this.moduleManagementService.isModuleEnabledInAnyActiveWorkspace("ddt_processing")) {
      return { running: true, shared: true, error: null };
    }

    try {
      const result = await this.pythonModulesClient.stopOcrContainer();
      return { ...result, shared: false, error: null };
    } catch (error) {
      return {
        running: true,
        shared: false,
        error: error instanceof Error ? error.message : "OCR container stop failed",
      };
    }
  }

  private getModuleKey(raw: string): string {
    if (!raw || !raw.trim()) {
      throw new AppError("Module key is required.", "MODULE_KEY_REQUIRED", 400);
    }

    return raw.trim();
  }
}
