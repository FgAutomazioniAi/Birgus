export class UpdateCompanyCommand {
  public readonly workspaceId: string;
  public readonly companyId: number;
  public readonly name: string;
  public readonly address: string;
  public readonly postalCode: string;
  public readonly city: string;
  public readonly actorUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    companyId: number;
    name: string;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    actorUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.companyId = params.companyId;
    this.name = params.name.trim();
    this.address = params.address?.trim() || "";
    this.postalCode = params.postalCode?.trim() || "";
    this.city = params.city?.trim() || "";
    this.actorUserId = params.actorUserId ?? null;
  }
}
