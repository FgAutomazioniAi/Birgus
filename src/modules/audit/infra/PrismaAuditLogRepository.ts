import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AuditLogEntity } from "../domain/AuditLogEntity.js";
import { AuditLogRepository } from "../repositories/AuditLogRepository.js";

export class PrismaAuditLogRepository implements AuditLogRepository {
  public async create(params: {
    workspaceId: string;
    userId: string | null;
    moduleId: number | null;
    action: string;
    entityType: string;
    entityId: string | null;
    payload: unknown;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.auditLog.create({
      data: {
        workspace_id: params.workspaceId,
        user_id: params.userId,
        module_id: params.moduleId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        payload: params.payload as never,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      },
    });
  }

  public async list(params: {
    workspaceId: string;
    limit: number;
    moduleId?: number | null;
    userId?: string | null;
    action?: string | null;
    entityType?: string | null;
  }): Promise<AuditLogEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.auditLog.findMany({
      where: {
        workspace_id: params.workspaceId,
        module_id: params.moduleId ?? undefined,
        user_id: params.userId ?? undefined,
        action: params.action ?? undefined,
        entity_type: params.entityType ?? undefined,
      },
      include: {
        user: { select: { email: true } },
        module: { select: { key: true } },
      },
      orderBy: { created_at: "desc" },
      take: params.limit,
    });

    return rows.map((row) => new AuditLogEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      userEmail: row.user?.email ?? null,
      moduleKey: row.module?.key ?? null,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      payload: row.payload,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }));
  }
}
