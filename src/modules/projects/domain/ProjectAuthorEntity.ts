export class ProjectAuthorEntity {
  public readonly id: number;
  public readonly workspaceId: string;
  public readonly firstName: string;
  public readonly lastName: string | null;
  public readonly displayName: string;

  public constructor(params: {
    id: number;
    workspaceId: string;
    firstName: string;
    lastName: string | null;
    displayName: string;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.firstName = params.firstName;
    this.lastName = params.lastName;
    this.displayName = params.displayName;
  }
}
