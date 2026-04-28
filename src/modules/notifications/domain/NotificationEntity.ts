export class NotificationEntity {
  public readonly id: number;
  public readonly workspaceId: string;
  public readonly userId: string | null;
  public readonly moduleKey: string | null;
  public readonly type: string;
  public readonly title: string;
  public readonly message: string;
  public readonly readAt: Date | null;
  public readonly createdAt: Date;

  public constructor(params: {
    id: number;
    workspaceId: string;
    userId: string | null;
    moduleKey: string | null;
    type: string;
    title: string;
    message: string;
    readAt: Date | null;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.userId = params.userId;
    this.moduleKey = params.moduleKey;
    this.type = params.type;
    this.title = params.title;
    this.message = params.message;
    this.readAt = params.readAt;
    this.createdAt = params.createdAt;
  }
}
