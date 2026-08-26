import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ModuleOverrideMode } from "@prisma/client";
import { FastifyRequest } from "fastify";
import { z } from "zod";

import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { SuperadminService } from "../../modules/superadmin/services/SuperadminService.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";

const usersQuerySchema = z.object({
  search: z.string().trim().optional(),
  workspaceId: z.string().uuid().optional(),
});

const userParamsSchema = z.object({
  userId: z.string().uuid(),
});

const userModulesQuerySchema = z.object({
  workspaceId: z.string().uuid(),
});

const createUserSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().optional(),
  password: z.string().min(8),
  roleKeys: z.array(z.string().trim().min(1)).length(1),
});

const setUserStatusSchema = z.object({
  isActive: z.boolean(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

const moduleOverrideSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  moduleKey: z.string().trim().min(1),
  mode: z.enum(["ALLOW", "DENY"]),
  reason: z.string().trim().max(500).optional(),
});

const clearModuleOverrideSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  moduleKey: z.string().trim().min(1),
  confirmText: z.literal("cancella"),
});

const workspaceRolesSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  roleKeys: z.array(z.string().trim().min(1)).length(1),
});

const addUserWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  roleKey: z.string().trim().min(1),
});

const archiveParamsSchema = z.object({
  entityType: z.enum(["project", "project_version", "shipment", "document"]),
  entityId: z.string().min(1),
});

const restoreArchiveSchema = z.object({
  workspaceId: z.string().uuid(),
});

const hardDeleteArchiveSchema = z.object({
  workspaceId: z.string().uuid(),
  confirmText: z.literal("ELIMINA DEFINITIVAMENTE"),
  reason: z.string().trim().min(10).max(1000),
});

@Controller("/api/superadmin")
@UseGuards(RequestContextAuthGuard)
export class NestSuperadminController {
  public constructor(
    @Inject(SuperadminService)
    private readonly service: SuperadminService,
  ) {}

  @Get("workspaces")
  public async listWorkspaces(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    return { workspaces: await this.service.listWorkspaces() };
  }

  @Get("roles")
  public async listRoles(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    return { roles: await this.service.listRoles() };
  }

  @Get("modules")
  public async listModules(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    return { modules: await this.service.listModules() };
  }

  @Get("users")
  public async listUsers(
    @Query() queryRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const query = usersQuerySchema.parse(queryRaw);
    return { users: await this.service.listUsers(query.search ?? null, query.workspaceId ?? null) };
  }

  @Post("users")
  @HttpCode(201)
  public async createUser(
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const body = createUserSchema.parse(bodyRaw);
    const created = await this.service.createUserInWorkspace({
      workspaceId: body.workspaceId,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName ?? null,
      password: body.password,
      roleKeys: body.roleKeys,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return {
      ok: true,
      userId: created.userId,
      email: created.email,
    };
  }

  @Patch("users/:userId/status")
  @HttpCode(200)
  public async setUserStatus(
    @Param() paramsRaw: unknown,
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const params = userParamsSchema.parse(paramsRaw);
    const body = setUserStatusSchema.parse(bodyRaw);

    await this.service.setUserActiveStatus({
      targetUserId: params.userId,
      isActive: body.isActive,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true, userId: params.userId, isActive: body.isActive };
  }

  @Get("users/:userId/memberships")
  public async listUserMemberships(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const params = userParamsSchema.parse(paramsRaw);
    return {
      userId: params.userId,
      memberships: await this.service.listUserMemberships(params.userId),
    };
  }

  @Get("users/:userId/modules")
  public async listUserModules(
    @Param() paramsRaw: unknown,
    @Query() queryRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const params = userParamsSchema.parse(paramsRaw);
    const query = userModulesQuerySchema.parse(queryRaw);
    const modules = await this.service.listUserModules({
      workspaceId: query.workspaceId,
      userId: params.userId,
    });

    return {
      workspaceId: query.workspaceId,
      userId: params.userId,
      modules,
    };
  }

  @Post("users/:userId/workspaces")
  @HttpCode(200)
  public async addUserToWorkspace(
    @Param() paramsRaw: unknown,
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const params = userParamsSchema.parse(paramsRaw);
    const body = addUserWorkspaceSchema.parse(bodyRaw);

    await this.service.addUserToWorkspace({
      workspaceId: body.workspaceId,
      targetUserId: params.userId,
      roleKey: body.roleKey,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true };
  }

  @Post("users/:userId/reset-password")
  @HttpCode(200)
  public async resetUserPassword(
    @Param() paramsRaw: unknown,
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const params = userParamsSchema.parse(paramsRaw);
    const body = resetPasswordSchema.parse(bodyRaw);

    await this.service.resetUserPassword({
      targetUserId: params.userId,
      newPassword: body.newPassword,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true };
  }

  @Post("users/:userId/revoke-sessions")
  @HttpCode(200)
  public async revokeUserSessions(
    @Param() paramsRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const params = userParamsSchema.parse(paramsRaw);
    await this.service.revokeUserSessions({
      targetUserId: params.userId,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true };
  }

  @Post("users/:userId/reset-2fa")
  @HttpCode(200)
  public async resetUserTwoFactor(
    @Param() paramsRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const params = userParamsSchema.parse(paramsRaw);
    await this.service.resetUserTwoFactor({
      targetUserId: params.userId,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true };
  }

  @Put("module-overrides")
  @HttpCode(200)
  public async setModuleOverride(
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const body = moduleOverrideSchema.parse(bodyRaw);

    await this.service.setModuleOverride({
      workspaceId: body.workspaceId,
      targetUserId: body.userId,
      moduleKey: body.moduleKey,
      mode: body.mode as ModuleOverrideMode,
      reason: body.reason ?? null,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true };
  }

  @Delete("module-overrides")
  @HttpCode(200)
  public async clearModuleOverride(
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const body = clearModuleOverrideSchema.parse(bodyRaw);

    await this.service.clearModuleOverride({
      workspaceId: body.workspaceId,
      targetUserId: body.userId,
      moduleKey: body.moduleKey,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true };
  }

  @Put("workspace-roles")
  @HttpCode(200)
  public async replaceWorkspaceRoles(
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const body = workspaceRolesSchema.parse(bodyRaw);

    await this.service.replaceWorkspaceRoles({
      workspaceId: body.workspaceId,
      targetUserId: body.userId,
      roleKeys: body.roleKeys,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true };
  }

  @Post("archive/:entityType/:entityId/restore")
  @HttpCode(200)
  public async restoreArchive(
    @Param() paramsRaw: unknown,
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const params = archiveParamsSchema.parse(paramsRaw);
    const body = restoreArchiveSchema.parse(bodyRaw);

    await this.service.restoreArchivedItem({
      workspaceId: body.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true };
  }

  @Delete("archive/:entityType/:entityId/permanent")
  @HttpCode(200)
  public async hardDeleteArchive(
    @Param() paramsRaw: unknown,
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    await this.ensureSuperadmin(requestContext);
    const params = archiveParamsSchema.parse(paramsRaw);
    const body = hardDeleteArchiveSchema.parse(bodyRaw);

    await this.service.permanentlyDeleteArchivedItem({
      workspaceId: body.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
      reason: body.reason,
      auditContext: this.getAuditContext(requestContext, request),
    });

    return { ok: true };
  }

  private async ensureSuperadmin(requestContext: RequestContext): Promise<void> {
    await this.service.assertSuperadmin(requestContext.workspace.userId);
  }

  private getAuditContext(
    requestContext: RequestContext,
    request: FastifyRequest,
  ): {
    actorUserId: string;
    actorWorkspaceId: string;
    ipAddress: string | null;
    userAgent: string | null;
  } {
    return {
      actorUserId: requestContext.workspace.userId,
      actorWorkspaceId: requestContext.workspace.workspaceId,
      ipAddress: this.getIpAddress(request),
      userAgent: this.getUserAgent(request),
    };
  }

  private getIpAddress(request: FastifyRequest): string | null {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0]?.trim() ?? null;
    }

    const realIp = request.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) {
      return realIp.trim();
    }

    return null;
  }

  private getUserAgent(request: FastifyRequest): string | null {
    const value = request.headers["user-agent"];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
}
