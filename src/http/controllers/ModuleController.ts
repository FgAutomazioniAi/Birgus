import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleManagementService } from "../../modules/module-management/services/ModuleManagementService.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const configureUserModuleSchema = z.object({
  reason: z.string().max(500).optional(),
});

export class ModuleController {
  private readonly moduleManagementService: ModuleManagementService;
  private readonly permissionGuard: PermissionGuard;

  public constructor(moduleManagementService: ModuleManagementService, permissionGuard: PermissionGuard) {
    this.moduleManagementService = moduleManagementService;
    this.permissionGuard = permissionGuard;
  }

  public listWorkspaceModules = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.MODULES_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const modules = await this.moduleManagementService.listWorkspaceModules(workspaceId);

      reply.code(200).send({
        workspaceId,
        modules: modules.map((item) => ({ moduleKey: item.moduleKey, enabled: item.enabled })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public enableModule = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.MODULES_CONFIGURE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const configuredByUserId = request.requestContext.workspace.userId;
      const moduleKey = this.getModuleKey(request);

      await this.moduleManagementService.enableModule(workspaceId, moduleKey, configuredByUserId);
      reply.code(200).send({ ok: true, workspaceId, moduleKey, enabled: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public disableModule = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.MODULES_CONFIGURE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const configuredByUserId = request.requestContext.workspace.userId;
      const moduleKey = this.getModuleKey(request);

      await this.moduleManagementService.disableModule(workspaceId, moduleKey, configuredByUserId);
      reply.code(200).send({ ok: true, workspaceId, moduleKey, enabled: false });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listUserModules = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.MODULES_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = this.getUserId(request);
      const modules = await this.moduleManagementService.listUserModules(workspaceId, userId);

      reply.code(200).send({
        workspaceId,
        userId,
        modules: modules.map((item) => ({
          moduleKey: item.moduleKey,
          workspaceEnabled: item.workspaceEnabled,
          overrideMode: item.overrideMode,
          effectiveEnabled: item.effectiveEnabled,
        })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public allowModuleForUser = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.MODULES_CONFIGURE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const configuredByUserId = request.requestContext.workspace.userId;
      const userId = this.getUserId(request);
      const moduleKey = this.getModuleKey(request);
      const payload = configureUserModuleSchema.parse(request.body ?? {});

      await this.moduleManagementService.allowModuleForUser(
        workspaceId,
        userId,
        moduleKey,
        configuredByUserId,
        payload.reason ?? null,
      );

      reply.code(200).send({ ok: true, workspaceId, userId, moduleKey, overrideMode: "ALLOW" });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public denyModuleForUser = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.MODULES_CONFIGURE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const configuredByUserId = request.requestContext.workspace.userId;
      const userId = this.getUserId(request);
      const moduleKey = this.getModuleKey(request);
      const payload = configureUserModuleSchema.parse(request.body ?? {});

      await this.moduleManagementService.denyModuleForUser(
        workspaceId,
        userId,
        moduleKey,
        configuredByUserId,
        payload.reason ?? null,
      );

      reply.code(200).send({ ok: true, workspaceId, userId, moduleKey, overrideMode: "DENY" });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public clearUserOverride = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.MODULES_CONFIGURE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = this.getUserId(request);
      const moduleKey = this.getModuleKey(request);

      await this.moduleManagementService.clearUserOverride(workspaceId, userId, moduleKey);
      reply.code(200).send({ ok: true, workspaceId, userId, moduleKey, overrideMode: null });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getUserId(request: AuthenticatedRequest): string {
    const value = (request.params as { userId?: string }).userId;
    if (!value || !value.trim()) {
      throw new AppError("User ID is required.", "USER_ID_REQUIRED", 400);
    }

    return value.trim();
  }

  private getModuleKey(request: AuthenticatedRequest): string {
    const raw = (request.params as { moduleKey?: string }).moduleKey;

    if (!raw || !raw.trim()) {
      throw new AppError("Module key is required.", "MODULE_KEY_REQUIRED", 400);
    }

    return raw.trim();
  }

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof z.ZodError) {
      reply.code(400).send({ code: "VALIDATION_ERROR", message: "Invalid payload.", issues: error.issues });
      return;
    }

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code, message: error.message });
      return;
    }

    reply.code(500).send({ code: "INTERNAL_ERROR", message: "Unexpected error." });
  }
}
