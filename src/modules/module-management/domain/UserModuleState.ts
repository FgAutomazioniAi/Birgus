export type UserModuleOverrideMode = "ALLOW" | "DENY" | null;

export class UserModuleState {
  public readonly moduleKey: string;
  public readonly workspaceEnabled: boolean;
  public readonly overrideMode: UserModuleOverrideMode;
  public readonly effectiveEnabled: boolean;

  public constructor(params: {
    moduleKey: string;
    workspaceEnabled: boolean;
    overrideMode: UserModuleOverrideMode;
    effectiveEnabled: boolean;
  }) {
    this.moduleKey = params.moduleKey;
    this.workspaceEnabled = params.workspaceEnabled;
    this.overrideMode = params.overrideMode;
    this.effectiveEnabled = params.effectiveEnabled;
  }
}
