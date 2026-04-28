export class ClientEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly email: string;
  public readonly phone: string;
  public readonly notes: string;
  public readonly createdAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    name: string;
    email: string;
    phone: string;
    notes: string;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.name = params.name;
    this.email = params.email;
    this.phone = params.phone;
    this.notes = params.notes;
    this.createdAt = params.createdAt;
  }
}
