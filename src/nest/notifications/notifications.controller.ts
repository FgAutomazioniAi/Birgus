import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const createNotificationSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  moduleKey: z.string().nullable().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
});

const clearNotificationsSchema = z.object({
  confirmText: z.string().min(1),
});

@Controller("/api/notifications")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.NOTIFICATION_CENTER)
export class NestNotificationsController {
  public constructor(
    @Inject(NotificationService)
    private readonly service: NotificationService,
  ) {}

  @Get()
  @RequirePermission(PermissionKey.NOTIFICATIONS_READ)
  public async listForUser(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const notifications = await this.service.listForUser(workspaceId, userId);

    return notifications.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      moduleKey: item.moduleKey,
      readAt: item.readAt,
      reference: null,
      createdAt: item.createdAt,
    }));
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PermissionKey.NOTIFICATIONS_WRITE)
  public async createInfo(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = createNotificationSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;

    const created = await this.service.createInfo({
      workspaceId,
      userId: body.userId ?? null,
      moduleKey: body.moduleKey ?? null,
      title: body.title,
      message: body.message,
    });

    return {
      id: created.id,
      workspaceId: created.workspaceId,
      type: created.type,
      title: created.title,
    };
  }

  @Patch()
  @HttpCode(200)
  @RequirePermission(PermissionKey.NOTIFICATIONS_READ)
  public async markAllAsRead(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<{ ok: true }> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;

    await this.service.markAllAsRead(workspaceId, userId);
    return { ok: true };
  }

  @Patch("read-all")
  @HttpCode(200)
  @RequirePermission(PermissionKey.NOTIFICATIONS_READ)
  public async markAllAsReadCompatibility(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<{ ok: true }> {
    return this.markAllAsRead(requestContext);
  }

  @Delete()
  @HttpCode(200)
  @RequirePermission(PermissionKey.NOTIFICATIONS_WRITE)
  public async clearForUser(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<{ ok: true }> {
    const body = clearNotificationsSchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;

    await this.service.clearForUser(workspaceId, userId);
    return { ok: true };
  }
}
