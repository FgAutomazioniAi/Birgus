export class UserPreferenceEntity {
  public readonly userId: string;
  public readonly workspaceId: string | null;
  public readonly paletteId: string;
  public readonly notificationPosition: string;
  public readonly notificationPopups: boolean;
  public readonly languageCode: string;
  public readonly rowsProjects: number;
  public readonly rowsClients: number;
  public readonly columnsProjects: unknown | null;
  public readonly columnsClients: unknown | null;

  public constructor(params: {
    userId: string;
    workspaceId: string | null;
    paletteId: string;
    notificationPosition: string;
    notificationPopups: boolean;
    languageCode: string;
    rowsProjects: number;
    rowsClients: number;
    columnsProjects: unknown | null;
    columnsClients: unknown | null;
  }) {
    this.userId = params.userId;
    this.workspaceId = params.workspaceId;
    this.paletteId = params.paletteId;
    this.notificationPosition = params.notificationPosition;
    this.notificationPopups = params.notificationPopups;
    this.languageCode = params.languageCode;
    this.rowsProjects = params.rowsProjects;
    this.rowsClients = params.rowsClients;
    this.columnsProjects = params.columnsProjects;
    this.columnsClients = params.columnsClients;
  }
}
