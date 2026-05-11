import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { UpdateModuleAgentPromptCommand } from "../../modules/agents/dto/UpdateModuleAgentPromptCommand.js";
import { ModuleAgentService } from "../../modules/agents/services/ModuleAgentService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const updateModuleAgentSchema = z.object({
  activePrompt: z.string().min(1),
});

export class ModuleAgentController {
  private readonly service: ModuleAgentService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: ModuleAgentService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public listAgents = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.AGENT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.AGENTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const agents = await this.service.listModuleAgents(workspaceId);

      reply.code(200).send({
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
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public updateAgentPrompt = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.AGENT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.AGENTS_WRITE);

      const body = updateModuleAgentSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const updatedByUserId = request.requestContext.workspace.userId;
      const agentId = this.getAgentId(request);

      const updated = await this.service.updateModuleAgentPrompt(
        new UpdateModuleAgentPromptCommand({
          workspaceId,
          agentId,
          activePrompt: body.activePrompt,
          updatedByUserId,
        }),
      );

      reply.code(200).send({
        id: updated.id,
        activePrompt: updated.activePrompt,
        originalPrompt: updated.originalPrompt,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public resetAgentPrompt = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.AGENT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.AGENTS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const updatedByUserId = request.requestContext.workspace.userId;
      const agentId = this.getAgentId(request);
      const updated = await this.service.resetModuleAgentPrompt(workspaceId, agentId, updatedByUserId);

      reply.code(200).send({
        id: updated.id,
        activePrompt: updated.activePrompt,
        originalPrompt: updated.originalPrompt,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getAgentId(request: AuthenticatedRequest): string {
    const value = (request.params as { agentId?: string }).agentId;
    if (!value || !value.trim()) {
      throw new AppError("Agent ID is required.", "MODULE_AGENT_ID_REQUIRED", 400);
    }

    return value.trim();
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
