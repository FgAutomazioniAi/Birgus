import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  moduleKey: z.string().trim().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
});

export class AuditController {
  public constructor(
    private readonly service: AuditLogService,
    private readonly moduleGuard: ModuleGuard,
    private readonly permissionGuard: PermissionGuard,
  ) {}

  public list = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.AUDIT_CENTER);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.AUDIT_READ);
      const query = querySchema.parse(request.query);
      const rows = await this.service.list({
        workspaceId: request.requestContext.workspace.workspaceId,
        limit: query.limit,
        moduleKey: query.moduleKey ?? null,
        userId: query.userId ?? null,
        action: query.action ?? null,
        entityType: query.entityType ?? null,
      });

      reply.code(200).send({
        logs: rows.map((item) => ({
          id: item.id,
          moduleKey: item.moduleKey,
          action: item.action,
          entityType: item.entityType,
          entityId: item.entityId,
          userId: item.userId,
          userEmail: item.userEmail,
          payload: item.payload,
          ipAddress: item.ipAddress,
          userAgent: item.userAgent,
          createdAt: item.createdAt,
        })),
      });
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
