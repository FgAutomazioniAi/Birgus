export class ClientEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly companyId: number | null;
  public readonly companyName: string;
  public readonly email: string;
  public readonly phone: string;
  public readonly notes: string;
  public readonly createdAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    name: string;
    companyId?: number | null;
    companyName?: string | null;
    email: string;
    phone: string;
    notes: string;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.name = params.name;
    this.companyId = params.companyId ?? null;
    this.companyName = params.companyName ?? "";
    this.email = params.email;
    this.phone = params.phone;
    this.notes = params.notes;
    this.createdAt = params.createdAt;
  }
}
