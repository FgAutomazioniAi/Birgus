export interface ModuleAccessReader {
  isModuleEnabledForUser(workspaceId: string, userId: string, moduleKey: string): Promise<boolean>;
}
