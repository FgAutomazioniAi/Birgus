export class AssistantMessageEntity {
  public readonly id!: string;
  public readonly sessionId!: string;
  public readonly workspaceId!: string;
  public readonly authorUserId!: string | null;
  public readonly role!: string;
  public readonly sequenceNo!: number;
  public readonly contentText!: string | null;
  public readonly contentPayload!: Record<string, unknown> | null;
  public readonly modelName!: string | null;
  public readonly promptTokens!: number | null;
  public readonly completionTokens!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public constructor(params: {
    id: string;
    sessionId: string;
    workspaceId: string;
    authorUserId: string | null;
    role: string;
    sequenceNo: number;
    contentText: string | null;
    contentPayload: Record<string, unknown> | null;
    modelName: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    Object.assign(this, params);
  }
}
