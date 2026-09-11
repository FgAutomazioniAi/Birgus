import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { BrainyWorkspaceDatabaseConnectionService } from "../../modules/brainyware/services/BrainyWorkspaceDatabaseConnectionService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const enableSchema = z.object({
  brainywareConnectionId: z.string().trim().min(1).max(160),
});
const enabledSchema = z.object({
  isEnabled: z.boolean(),
});
const accessSchema = z.object({
  accessMode: z.enum(["ALL", "ASSIGNED"]),
  roleIds: z.array(z.number().int().positive()).max(2),
  isWorkflowEnabled: z.boolean(),
});

@Controller("/api/brainy/settings/database-connections")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.BRAINY)
@RequirePermission(PermissionKey.BRAINY_CONFIGURE)
export class BrainyWorkspaceDatabaseConnectionsController {
  public constructor(
    @Inject(BrainyWorkspaceDatabaseConnectionService)
    private readonly service: BrainyWorkspaceDatabaseConnectionService,
  ) {}

  @Get()
  public async list(@CurrentRequestContext() context: RequestContext) {
    return {
      connections: await this.service.list(context.workspace.workspaceId),
    };
  }

  @Get("access-options")
  public async accessOptions(@CurrentRequestContext() context: RequestContext) {
    return this.service.accessOptions(context.workspace.workspaceId);
  }

  @Get("available")
  public async available() {
    return {
      connections: await this.service.listAvailable(),
    };
  }

  @Post()
  public async enable(
    @Body() body: unknown,
    @CurrentRequestContext() context: RequestContext,
  ) {
    const { brainywareConnectionId } = enableSchema.parse(body);

    return {
      connection: await this.service.enable(
        context.workspace.workspaceId,
        context.workspace.userId,
        brainywareConnectionId,
      ),
    };
  }

  @Patch(":id/access")
  public async setAccess(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentRequestContext() context: RequestContext,
  ) {
    const data = accessSchema.parse(body);
    await this.service.setAccess(
      context.workspace.workspaceId,
      id,
      data.accessMode,
      data.roleIds,
      data.isWorkflowEnabled,
    );

    return { ok: true };
  }

  @Patch(":id")
  public async setEnabled(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentRequestContext() context: RequestContext,
  ) {
    const { isEnabled } = enabledSchema.parse(body);
    await this.service.setEnabled(context.workspace.workspaceId, id, isEnabled);

    return { ok: true };
  }

  @Delete(":id")
  @HttpCode(204)
  public async archive(
    @Param("id") id: string,
    @CurrentRequestContext() context: RequestContext,
  ): Promise<void> {
    await this.service.archive(context.workspace.workspaceId, id);
  }
}
