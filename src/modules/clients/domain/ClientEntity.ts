export class ClientEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly companyId: number | null;
  public readonly companyName: string;
  public readonly role: string;
  public readonly department: string;
  public readonly email: string;
  public readonly phone: string;
  public readonly mobile: string;
  public readonly address: string;
  public readonly city: string;
  public readonly province: string;
  public readonly country: string;
  public readonly notes: string;
  public readonly createdAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    name: string;
    companyId?: number | null;
    companyName?: string | null;
    role?: string | null;
    department?: string | null;
    email: string;
    phone: string;
    mobile?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    notes: string;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.name = params.name;
    this.companyId = params.companyId ?? null;
    this.companyName = params.companyName ?? "";
    this.role = params.role ?? "";
    this.department = params.department ?? "";
    this.email = params.email;
    this.phone = params.phone;
    this.mobile = params.mobile ?? "";
    this.address = params.address ?? "";
    this.city = params.city ?? "";
    this.province = params.province ?? "";
    this.country = params.country ?? "";
    this.notes = params.notes;
    this.createdAt = params.createdAt;
  }
}
