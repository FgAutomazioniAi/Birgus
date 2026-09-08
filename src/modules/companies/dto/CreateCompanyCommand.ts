export class CreateCompanyCommand {
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly isHeadquarters: boolean;
  public readonly legalName: string;
  public readonly vatNumber: string;
  public readonly taxCode: string;
  public readonly email: string;
  public readonly phone: string;
  public readonly website: string;
  public readonly industry: string;
  public readonly address: string;
  public readonly postalCode: string;
  public readonly city: string;
  public readonly province: string;
  public readonly country: string;
  public readonly latitude: string;
  public readonly longitude: string;
  public readonly notes: string;
  public readonly actorUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    name: string;
    isHeadquarters?: boolean;
    legalName?: string | null;
    vatNumber?: string | null;
    taxCode?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    industry?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    notes?: string | null;
    actorUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.name = params.name.trim();
    this.isHeadquarters = params.isHeadquarters ?? false;
    this.legalName = params.legalName?.trim() || "";
    this.vatNumber = params.vatNumber?.trim() || "";
    this.taxCode = params.taxCode?.trim() || "";
    this.email = params.email?.trim() || "";
    this.phone = params.phone?.trim() || "";
    this.website = params.website?.trim() || "";
    this.industry = params.industry?.trim() || "";
    this.address = params.address?.trim() || "";
    this.postalCode = params.postalCode?.trim() || "";
    this.city = params.city?.trim() || "";
    this.province = params.province?.trim() || "";
    this.country = params.country?.trim() || "";
    this.latitude = params.latitude?.trim() || "";
    this.longitude = params.longitude?.trim() || "";
    this.notes = params.notes?.trim() || "";
    this.actorUserId = params.actorUserId ?? null;
  }
}
