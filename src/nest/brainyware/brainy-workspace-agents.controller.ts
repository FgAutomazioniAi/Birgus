import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { BrainyWorkspaceAgentService } from "../../modules/brainyware/services/BrainyWorkspaceAgentService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const agentSchema = z.object({
  brainywareAgentId: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(120),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

@Controller("/api/brainy/settings/agents")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.BRAINY)
@RequirePermission(PermissionKey.BRAINY_CONFIGURE)
export class BrainyWorkspaceAgentsController {
  public constructor(
    @Inject(BrainyWorkspaceAgentService)
    private readonly service: BrainyWorkspaceAgentService,
  ) {}

  @Get()
  public async list(@CurrentRequestContext() context: RequestContext) {
    return { agents: await this.service.list(context.workspace.workspaceId) };
  }

  @Get("available")
  public async available() { return { agents: await this.service.listAvailable() }; }

  @Post()
  public async create(@Body() body: unknown, @CurrentRequestContext() context: RequestContext) {
    return { agent: await this.service.create(context.workspace.workspaceId, context.workspace.userId, agentSchema.parse(body)) };
  }

  @Patch(":id")
  public async update(@Param("id") id: string, @Body() body: unknown, @CurrentRequestContext() context: RequestContext) {
    return { agent: await this.service.update(context.workspace.workspaceId, context.workspace.userId, id, agentSchema.parse(body)) };
  }

  @Delete(":id")
  @HttpCode(204)
  public async archive(@Param("id") id: string, @CurrentRequestContext() context: RequestContext): Promise<void> {
    await this.service.archive(context.workspace.workspaceId, context.workspace.userId, id);
  }
}
