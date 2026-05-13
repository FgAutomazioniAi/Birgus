export class AuditLogEntity {
  public readonly id: number;
  public readonly workspaceId: string;
  public readonly userId: string | null;
  public readonly userEmail: string | null;
  public readonly moduleKey: string | null;
  public readonly action: string;
  public readonly entityType: string;
  public readonly entityId: string | null;
  public readonly payload: unknown;
  public readonly ipAddress: string;
  public readonly userAgent: string;
  public readonly createdAt: Date;

  public constructor(params: {
    id: number;
    workspaceId: string;
    userId?: string | null;
    userEmail?: string | null;
    moduleKey?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    payload?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.userId = params.userId ?? null;
    this.userEmail = params.userEmail ?? null;
    this.moduleKey = params.moduleKey ?? null;
    this.action = params.action;
    this.entityType = params.entityType;
    this.entityId = params.entityId ?? null;
    this.payload = params.payload ?? null;
    this.ipAddress = params.ipAddress ?? "";
    this.userAgent = params.userAgent ?? "";
    this.createdAt = params.createdAt;
  }
}
