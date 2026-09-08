export class CompanyEntity {
  public readonly id: number;
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
  public readonly createdAt: Date;

  public constructor(params: {
    id: number;
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
    latitude?: string | number | null;
    longitude?: string | number | null;
    notes?: string | null;
    createdAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.name = params.name;
    this.isHeadquarters = params.isHeadquarters ?? false;
    this.legalName = params.legalName ?? "";
    this.vatNumber = params.vatNumber ?? "";
    this.taxCode = params.taxCode ?? "";
    this.email = params.email ?? "";
    this.phone = params.phone ?? "";
    this.website = params.website ?? "";
    this.industry = params.industry ?? "";
    this.address = params.address ?? "";
    this.postalCode = params.postalCode ?? "";
    this.city = params.city ?? "";
    this.province = params.province ?? "";
    this.country = params.country ?? "";
    this.latitude = params.latitude === null || typeof params.latitude === "undefined" ? "" : String(params.latitude);
    this.longitude = params.longitude === null || typeof params.longitude === "undefined" ? "" : String(params.longitude);
    this.notes = params.notes ?? "";
    this.createdAt = params.createdAt;
  }
}
