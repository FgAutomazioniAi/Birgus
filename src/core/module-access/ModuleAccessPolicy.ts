import { AppError } from "../errors/AppError.js";
import { ModuleAccessReader } from "./ModuleAccessReader.js";

export class ModuleAccessPolicy {
  private readonly moduleAccessReader: ModuleAccessReader;

  public constructor(moduleAccessReader: ModuleAccessReader) {
    this.moduleAccessReader = moduleAccessReader;
  }

  public async ensureEnabled(workspaceId: string, userId: string, moduleKey: string): Promise<void> {
    const enabled = await this.moduleAccessReader.isModuleEnabledForUser(workspaceId, userId, moduleKey);

    if (!enabled) {
      throw new AppError(
        `Module '${moduleKey}' is disabled for this user/workspace.`,
        "MODULE_DISABLED",
        403,
      );
    }
  }

  public async ensureEnabledForWorkspace(workspaceId: string, moduleKey: string): Promise<void> {
    const enabled = await this.moduleAccessReader.isModuleEnabledForWorkspace(workspaceId, moduleKey);
    if (!enabled) {
      throw new AppError(
        `Module '${moduleKey}' is disabled for this workspace.`,
        "MODULE_DISABLED",
        403,
      );
    }
  }
}
