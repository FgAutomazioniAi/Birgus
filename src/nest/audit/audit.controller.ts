import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  moduleKey: z.string().trim().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
});

@Controller("/api/audit")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.AUDIT_CENTER)
export class NestAuditController {
  public constructor(
    @Inject(AuditLogService)
    private readonly service: AuditLogService,
  ) {}

  @Get("logs")
  @RequirePermission(PermissionKey.AUDIT_READ)
  public async list(
    @Query() queryRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const query = querySchema.parse(queryRaw);
    const rows = await this.service.list({
      workspaceId: requestContext.workspace.workspaceId,
      limit: query.limit,
      moduleKey: query.moduleKey ?? null,
      userId: query.userId ?? null,
      action: query.action ?? null,
      entityType: query.entityType ?? null,
    });

    return {
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
    };
  }
}
