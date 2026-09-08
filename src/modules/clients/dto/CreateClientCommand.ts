export class CreateClientCommand {
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly companyId: number | null;
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
  public readonly actorUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    name: string;
    companyId?: number | null;
    role?: string | null;
    department?: string | null;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    notes?: string | null;
    actorUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.name = params.name;
    this.companyId = params.companyId ?? null;
    this.role = params.role?.trim() || "";
    this.department = params.department?.trim() || "";
    this.email = params.email?.trim() || "";
    this.phone = params.phone?.trim() || "";
    this.mobile = params.mobile?.trim() || "";
    this.address = params.address?.trim() || "";
    this.city = params.city?.trim() || "";
    this.province = params.province?.trim() || "";
    this.country = params.country?.trim() || "";
    this.notes = params.notes?.trim() || "";
    this.actorUserId = params.actorUserId ?? null;
  }
}
