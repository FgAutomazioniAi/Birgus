import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { CreateProjectAuthorCommand } from "../../modules/project-authors/dto/CreateProjectAuthorCommand.js";
import { UpdateProjectAuthorCommand } from "../../modules/project-authors/dto/UpdateProjectAuthorCommand.js";
import { ProjectAuthorService } from "../../modules/project-authors/services/ProjectAuthorService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const payloadSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().trim().optional().default(""),
  displayName: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

const deleteProjectAuthorSchema = z.object({
  confirmText: z.string().min(1),
});

export class ProjectAuthorController {
  public constructor(
    private readonly service: ProjectAuthorService,
    private readonly moduleGuard: ModuleGuard,
    private readonly permissionGuard: PermissionGuard,
  ) {}

  public list = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_READ);
      const items = await this.service.list(request.requestContext.workspace.workspaceId);
      reply.code(200).send(items.map((item) => ({
        id: item.id,
        firstName: item.firstName,
        lastName: item.lastName,
        displayName: item.displayName,
        notes: item.notes,
      })));
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getById = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_READ);
      const item = await this.service.getById(request.requestContext.workspace.workspaceId, this.getAuthorId(request));
      reply.code(200).send({
        id: item.id,
        firstName: item.firstName,
        lastName: item.lastName,
        displayName: item.displayName,
        notes: item.notes,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public create = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);
      const body = payloadSchema.parse(request.body);
      const created = await this.service.create(new CreateProjectAuthorCommand({
        workspaceId: request.requestContext.workspace.workspaceId,
        firstName: body.firstName,
        lastName: body.lastName,
        displayName: body.displayName,
        notes: body.notes,
        actorUserId: request.requestContext.workspace.userId,
      }));
      reply.code(201).send({
        id: created.id,
        firstName: created.firstName,
        lastName: created.lastName,
        displayName: created.displayName,
        notes: created.notes,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public update = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);
      const body = payloadSchema.parse(request.body);
      const updated = await this.service.update(new UpdateProjectAuthorCommand({
        workspaceId: request.requestContext.workspace.workspaceId,
        authorId: this.getAuthorId(request),
        firstName: body.firstName,
        lastName: body.lastName,
        displayName: body.displayName,
        notes: body.notes,
        actorUserId: request.requestContext.workspace.userId,
      }));
      reply.code(200).send({
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        displayName: updated.displayName,
        notes: updated.notes,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public delete = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);
      const body = deleteProjectAuthorSchema.parse(request.body);
      if (body.confirmText.trim() !== "cancella") {
        throw new AppError(
          "Conferma eliminazione non valida: digita 'cancella'.",
          "DELETE_CONFIRMATION_INVALID",
          400,
        );
      }
      const authorId = this.getAuthorId(request);
      await this.service.delete(request.requestContext.workspace.workspaceId, authorId, request.requestContext.workspace.userId);
      reply.code(200).send({ ok: true, id: authorId });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getAuthorId(request: AuthenticatedRequest): number {
    const value = (request.params as { authorId?: string }).authorId;
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError("Project author ID is invalid.", "PROJECT_AUTHOR_ID_INVALID", 400);
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
