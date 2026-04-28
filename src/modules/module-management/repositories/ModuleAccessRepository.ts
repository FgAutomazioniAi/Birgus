import { ModuleAccessReader } from "../../../core/module-access/ModuleAccessReader.js";
import { UserModuleState } from "../domain/UserModuleState.js";
import { WorkspaceModuleState } from "../domain/WorkspaceModuleState.js";

export interface ModuleAccessRepository extends ModuleAccessReader {
  listWorkspaceModules(workspaceId: string): Promise<WorkspaceModuleState[]>;
  listUserModules(workspaceId: string, userId: string): Promise<UserModuleState[]>;
  setWorkspaceModule(workspaceId: string, moduleKey: string, enabled: boolean, configuredByUserId: string): Promise<void>;
  setUserModuleOverride(
    workspaceId: string,
    userId: string,
    moduleKey: string,
    mode: "ALLOW" | "DENY",
    configuredByUserId: string,
    reason?: string | null,
  ): Promise<void>;
  clearUserModuleOverride(workspaceId: string, userId: string, moduleKey: string): Promise<void>;
  listMissingDependenciesForEnable(workspaceId: string, moduleKey: string): Promise<string[]>;
  listEnabledDependents(workspaceId: string, moduleKey: string): Promise<string[]>;
}
