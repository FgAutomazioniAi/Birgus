import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { UpdateModuleAgentPromptCommand } from "../../modules/agents/dto/UpdateModuleAgentPromptCommand.js";
import { ModuleAgentService } from "../../modules/agents/services/ModuleAgentService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const updateModuleAgentSchema = z.object({
  activePrompt: z.string().min(1),
});

@Controller("/api/agents")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.AGENT_MANAGEMENT)
export class NestAgentsController {
  public constructor(
    @Inject(ModuleAgentService)
    private readonly service: ModuleAgentService,
  ) {}

  @Get()
  @RequirePermission(PermissionKey.AGENTS_READ)
  public async listAgents(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const agents = await this.service.listModuleAgents(workspaceId);

    return {
      workspaceId,
      agents: agents.map((item) => ({
        id: item.id,
        moduleId: item.moduleId,
        moduleKey: item.moduleKey,
        moduleName: item.moduleName,
        key: item.key,
        name: item.name,
        label: item.label,
        originalPrompt: item.originalPrompt,
        activePrompt: item.activePrompt,
        isEnabled: item.isEnabled,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };
  }

  @Patch(":agentId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.AGENTS_WRITE)
  public async updateAgentPrompt(
    @Param("agentId") agentIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = updateModuleAgentSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const updatedByUserId = requestContext.workspace.userId;
    const agentId = this.getAgentId(agentIdRaw);

    const updated = await this.service.updateModuleAgentPrompt(
      new UpdateModuleAgentPromptCommand({
        workspaceId,
        agentId,
        activePrompt: body.activePrompt,
        updatedByUserId,
      }),
    );

    return {
      id: updated.id,
      activePrompt: updated.activePrompt,
      originalPrompt: updated.originalPrompt,
      updatedAt: updated.updatedAt,
    };
  }

  @Post(":agentId/reset-prompt")
  @HttpCode(200)
  @RequirePermission(PermissionKey.AGENTS_WRITE)
  public async resetAgentPrompt(
    @Param("agentId") agentIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const updatedByUserId = requestContext.workspace.userId;
    const agentId = this.getAgentId(agentIdRaw);
    const updated = await this.service.resetModuleAgentPrompt(workspaceId, agentId, updatedByUserId);

    return {
      id: updated.id,
      activePrompt: updated.activePrompt,
      originalPrompt: updated.originalPrompt,
      updatedAt: updated.updatedAt,
    };
  }

  private getAgentId(agentId: string): string {
    if (!agentId || !agentId.trim()) {
      throw new AppError("Agent ID is required.", "MODULE_AGENT_ID_REQUIRED", 400);
    }

    return agentId.trim();
  }
}
