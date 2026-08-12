import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AuditLogEntity } from "../domain/AuditLogEntity.js";
import { AuditLogRepository } from "../repositories/AuditLogRepository.js";

export class AuditLogService {
  private readonly repository: AuditLogRepository;
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  public constructor(repository: AuditLogRepository) {
    this.repository = repository;
  }

  public async record(params: {
    workspaceId: string;
    userId?: string | null;
    moduleKey?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    payload?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    const moduleId = await this.resolveModuleId(params.moduleKey ?? null);
    await this.repository.create({
      workspaceId: params.workspaceId,
      userId: params.userId ?? null,
      moduleId,
      action: params.action,
      entityType: params.entityType,
      entityId: this.normalizeEntityId(params.entityId ?? null),
      payload: params.payload ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
  }

  public async list(params: {
    workspaceId: string;
    limit?: number;
    moduleKey?: string | null;
    userId?: string | null;
    action?: string | null;
    entityType?: string | null;
  }): Promise<AuditLogEntity[]> {
    const moduleId = await this.resolveModuleId(params.moduleKey ?? null);
    return this.repository.list({
      workspaceId: params.workspaceId,
      limit: Math.min(Math.max(params.limit ?? 50, 1), 200),
      moduleId,
      userId: params.userId ?? null,
      action: params.action ?? null,
      entityType: params.entityType ?? null,
    });
  }

  private async resolveModuleId(moduleKey: string | null): Promise<number | null> {
    if (!moduleKey) {
      return null;
    }

    const prisma = PrismaClientManager.getClient();
    const moduleRow = await prisma.module.findUnique({
      where: { key: moduleKey },
      select: { id: true },
    });

    return moduleRow?.id ?? null;
  }

  private normalizeEntityId(entityId: string | null): string | null {
    if (!entityId) {
      return null;
    }

    const normalized = entityId.trim();
    if (!normalized) {
      return null;
    }

    return AuditLogService.UUID_REGEX.test(normalized) ? normalized : null;
  }
}
