export class CreateClientCommand {
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly companyId: number | null;
  public readonly email: string;
  public readonly phone: string;
  public readonly notes: string;
  public readonly actorUserId: string | null;

  public constructor(params: {
    workspaceId: string;
    name: string;
    companyId?: number | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    actorUserId?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.name = params.name;
    this.companyId = params.companyId ?? null;
    this.email = params.email?.trim() || "";
    this.phone = params.phone?.trim() || "";
    this.notes = params.notes?.trim() || "";
    this.actorUserId = params.actorUserId ?? null;
  }
}
