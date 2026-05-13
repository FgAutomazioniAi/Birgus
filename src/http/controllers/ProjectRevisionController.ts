import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { CreateProjectRevisionCommand } from "../../modules/project-revisions/dto/CreateProjectRevisionCommand.js";
import { UpdateProjectRevisionCommand } from "../../modules/project-revisions/dto/UpdateProjectRevisionCommand.js";
import { ProjectRevisionService } from "../../modules/project-revisions/services/ProjectRevisionService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const payloadSchema = z.object({
  code: z.string().min(1),
});

export class ProjectRevisionController {
  public constructor(
    private readonly service: ProjectRevisionService,
    private readonly moduleGuard: ModuleGuard,
    private readonly permissionGuard: PermissionGuard,
  ) {}

  public list = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_READ);
      const items = await this.service.list(request.requestContext.workspace.workspaceId);
      reply.code(200).send(items.map((item) => ({ id: item.id, code: item.code, createdAt: item.createdAt })));
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getById = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_READ);
      const item = await this.service.getById(request.requestContext.workspace.workspaceId, this.getRevisionId(request));
      reply.code(200).send({ id: item.id, code: item.code, createdAt: item.createdAt });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public create = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);
      const body = payloadSchema.parse(request.body);
      const created = await this.service.create(new CreateProjectRevisionCommand({
        workspaceId: request.requestContext.workspace.workspaceId,
        code: body.code,
        actorUserId: request.requestContext.workspace.userId,
      }));
      reply.code(201).send({ id: created.id, code: created.code, createdAt: created.createdAt });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public update = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);
      const body = payloadSchema.parse(request.body);
      const updated = await this.service.update(new UpdateProjectRevisionCommand({
        workspaceId: request.requestContext.workspace.workspaceId,
        revisionId: this.getRevisionId(request),
        code: body.code,
        actorUserId: request.requestContext.workspace.userId,
      }));
      reply.code(200).send({ id: updated.id, code: updated.code, createdAt: updated.createdAt });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public delete = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);
      const revisionId = this.getRevisionId(request);
      await this.service.delete(request.requestContext.workspace.workspaceId, revisionId, request.requestContext.workspace.userId);
      reply.code(200).send({ ok: true, id: revisionId });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getRevisionId(request: AuthenticatedRequest): number {
    const value = (request.params as { revisionId?: string }).revisionId;
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError("Project revision ID is invalid.", "PROJECT_REVISION_ID_INVALID", 400);
    }

    return parsed;
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
