import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const createNotificationSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  moduleKey: z.string().nullable().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
});

export class NotificationController {
  private readonly service: NotificationService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: NotificationService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public listForUser = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.NOTIFICATION_CENTER);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.NOTIFICATIONS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const notifications = await this.service.listForUser(workspaceId, userId);

      reply.code(200).send(
        notifications.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          message: item.message,
          moduleKey: item.moduleKey,
          readAt: item.readAt,
          reference: null,
          createdAt: item.createdAt,
        })),
      );
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public createInfo = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.NOTIFICATION_CENTER);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.NOTIFICATIONS_WRITE);

      const body = createNotificationSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;

      const created = await this.service.createInfo({
        workspaceId,
        userId: body.userId ?? null,
        moduleKey: body.moduleKey ?? null,
        title: body.title,
        message: body.message,
      });

      reply.code(201).send({
        id: created.id,
        workspaceId: created.workspaceId,
        type: created.type,
        title: created.title,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public markAllAsRead = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.NOTIFICATION_CENTER);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.NOTIFICATIONS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;

      await this.service.markAllAsRead(workspaceId, userId);
      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public clearForUser = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.NOTIFICATION_CENTER);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.NOTIFICATIONS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;

      await this.service.clearForUser(workspaceId, userId);
      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

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
