export class CompanyEntity {
  public readonly id: number;
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly address: string;
  public readonly postalCode: string;
  public readonly city: string;
  public readonly createdAt: Date;

  public constructor(params: {
    id: number;
    workspaceId: string;
    name: string;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.name = params.name;
    this.address = params.address ?? "";
    this.postalCode = params.postalCode ?? "";
    this.city = params.city ?? "";
    this.createdAt = params.createdAt;
  }
}
