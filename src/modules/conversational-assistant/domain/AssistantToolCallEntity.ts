export class AssistantToolCallEntity {
  public readonly id!: string;
  public readonly sessionId!: string;
  public readonly messageId!: string | null;
  public readonly workspaceId!: string;
  public readonly moduleId!: number | null;
  public readonly toolName!: string;
  public readonly status!: string;
  public readonly argumentsPayload!: Record<string, unknown> | null;
  public readonly resultPayload!: Record<string, unknown> | null;
  public readonly authorizationContext!: Record<string, unknown> | null;
  public readonly deniedReason!: string | null;
  public readonly startedAt!: Date | null;
  public readonly completedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public constructor(params: {
    id: string;
    sessionId: string;
    messageId: string | null;
    workspaceId: string;
    moduleId: number | null;
    toolName: string;
    status: string;
    argumentsPayload: Record<string, unknown> | null;
    resultPayload: Record<string, unknown> | null;
    authorizationContext: Record<string, unknown> | null;
    deniedReason: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    Object.assign(this, params);
  }
}
