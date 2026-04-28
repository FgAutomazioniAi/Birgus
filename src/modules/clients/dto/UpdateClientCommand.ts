export class UpdateClientCommand {
  public readonly workspaceId: string;
  public readonly clientId: string;
  public readonly name: string;
  public readonly email: string;
  public readonly phone: string;
  public readonly notes: string;

  public constructor(params: {
    workspaceId: string;
    clientId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  }) {
    this.workspaceId = params.workspaceId;
    this.clientId = params.clientId;
    this.name = params.name;
    this.email = params.email?.trim() || "";
    this.phone = params.phone?.trim() || "";
    this.notes = params.notes?.trim() || "";
  }
}
