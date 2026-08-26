export interface ModuleAccessReader {
  isModuleEnabledForUser(workspaceId: string, userId: string, moduleKey: string): Promise<boolean>;
  isModuleEnabledForWorkspace(workspaceId: string, moduleKey: string): Promise<boolean>;
}
