import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { ExternalDatabaseConnectionService } from "../../modules/external-databases/services/ExternalDatabaseConnectionService.js";
import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const connectionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    dbType: z.literal("sqlserver"),
    host: z.string().trim().min(1).max(255),
    port: z.number().int().min(1).max(65535),
    databaseName: z.string().trim().min(1).max(255),
    sourceView: z.string().trim().max(255).nullable().optional(),
    username: z.string().trim().min(1).max(255),
    password: z.string().trim().max(500).optional(),
    trustServerCertificate: z.boolean(),
    isEnabled: z.boolean(),
  })
  .strict();

const moduleBindingSchema = z.object({
  connectionId: z.string().uuid().nullable(),
});

@Controller("/api/settings/external-database-connections")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.COMMISSION_DETAILS)
@RequirePermission(PermissionKey.COMMISSION_DETAILS_CONFIGURE)
export class ExternalDatabaseConnectionsController {
  public constructor(
    @Inject(ExternalDatabaseConnectionService)
    private readonly service: ExternalDatabaseConnectionService,
    @Inject(AuditLogService) private readonly auditLog: AuditLogService,
  ) {}

  @Get()
  public async list(@CurrentRequestContext() context: RequestContext) {
    return {
      connections: await this.service.list(context.workspace.workspaceId),
    };
  }

  @Get("module-bindings")
  public async listModuleBindings(
    @CurrentRequestContext() context: RequestContext,
  ) {
    return {
      bindings: await this.service.listModuleBindings(
        context.workspace.workspaceId,
      ),
    };
  }

  @Put("module-bindings/commission-registry")
  public async setCommissionRegistryBinding(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() context: RequestContext,
  ) {
    const body = moduleBindingSchema.parse(bodyRaw);
    await this.service.setModuleBinding(
      context.workspace.workspaceId,
      "commission_registry",
      body.connectionId,
    );
    await this.auditLog.record({
      workspaceId: context.workspace.workspaceId,
      userId: context.workspace.userId,
      moduleKey: ModuleKey.COMMISSION_DETAILS,
      action: "settings.external_database.module_binding.updated",
      entityType: "ExternalDatabaseModuleBinding",
      entityId: null,
      payload: {
        moduleKey: "commission_registry",
        connectionId: body.connectionId,
      },
    });
    return { ok: true };
  }

  @Post()
  public async create(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() context: RequestContext,
  ) {
    const connection = await this.service.create(
      context.workspace.workspaceId,
      context.workspace.userId,
      connectionSchema.parse(bodyRaw),
    );
    await this.auditLog.record({
      workspaceId: context.workspace.workspaceId,
      userId: context.workspace.userId,
      moduleKey: ModuleKey.COMMISSION_DETAILS,
      action: "settings.external_database.created",
      entityType: "ExternalDatabaseConnection",
      entityId: connection.id,
      payload: { dbType: connection.dbType, name: connection.name },
    });
    return { connection };
  }

  @Patch(":id")
  public async update(
    @Param("id") id: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() context: RequestContext,
  ) {
    const body = connectionSchema.parse(bodyRaw);
    const connection = await this.service.update(
      context.workspace.workspaceId,
      id,
      body,
    );
    await this.auditLog.record({
      workspaceId: context.workspace.workspaceId,
      userId: context.workspace.userId,
      moduleKey: ModuleKey.COMMISSION_DETAILS,
      action: "settings.external_database.updated",
      entityType: "ExternalDatabaseConnection",
      entityId: connection.id,
      payload: {
        dbType: connection.dbType,
        name: connection.name,
        changedPassword: Boolean(body.password),
      },
    });
    return { connection };
  }

  @Delete(":id")
  @HttpCode(204)
  public async delete(
    @Param("id") id: string,
    @CurrentRequestContext() context: RequestContext,
  ): Promise<void> {
    await this.service.delete(context.workspace.workspaceId, id);
    await this.auditLog.record({
      workspaceId: context.workspace.workspaceId,
      userId: context.workspace.userId,
      moduleKey: ModuleKey.COMMISSION_DETAILS,
      action: "settings.external_database.deleted",
      entityType: "ExternalDatabaseConnection",
      entityId: id,
      payload: {},
    });
  }

  @Post(":id/test")
  public async test(
    @Param("id") id: string,
    @CurrentRequestContext() context: RequestContext,
  ): Promise<Record<string, boolean>> {
    await this.service.testConnection(context.workspace.workspaceId, id);
    return { ok: true };
  }
}
