export class ProjectRevisionEntity {
  public readonly id: number;
  public readonly workspaceId: string;
  public readonly code: string;
  public readonly createdAt: Date;

  public constructor(params: {
    id: number;
    workspaceId: string;
    code: string;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.code = params.code;
    this.createdAt = params.createdAt;
  }
}
