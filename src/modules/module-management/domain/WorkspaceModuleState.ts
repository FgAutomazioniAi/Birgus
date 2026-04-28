export class WorkspaceModuleState {
  public readonly moduleKey: string;
  public readonly enabled: boolean;

  public constructor(moduleKey: string, enabled: boolean) {
    this.moduleKey = moduleKey;
    this.enabled = enabled;
  }
}
