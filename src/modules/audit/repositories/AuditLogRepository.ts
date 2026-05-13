import { AuditLogEntity } from "../domain/AuditLogEntity.js";

export interface AuditLogRepository {
  create(params: {
    workspaceId: string;
    userId: string | null;
    moduleId: number | null;
    action: string;
    entityType: string;
    entityId: string | null;
    payload: unknown;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void>;
  list(params: {
    workspaceId: string;
    limit: number;
    moduleId?: number | null;
    userId?: string | null;
    action?: string | null;
    entityType?: string | null;
  }): Promise<AuditLogEntity[]>;
}
