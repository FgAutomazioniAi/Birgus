import { AppError } from "../../../core/errors/AppError.js";
import { UserModuleState } from "../domain/UserModuleState.js";
import { WorkspaceModuleState } from "../domain/WorkspaceModuleState.js";
import { ModuleAccessRepository } from "../repositories/ModuleAccessRepository.js";

export class ModuleManagementService {
  private readonly repository: ModuleAccessRepository;

  public constructor(repository: ModuleAccessRepository) {
    this.repository = repository;
  }

  public async listWorkspaceModules(workspaceId: string): Promise<WorkspaceModuleState[]> {
    return this.repository.listWorkspaceModules(workspaceId);
  }

  public async listUserModules(workspaceId: string, userId: string): Promise<UserModuleState[]> {
    return this.repository.listUserModules(workspaceId, userId);
  }

  public async enableModule(workspaceId: string, moduleKey: string, configuredByUserId: string): Promise<void> {
    const missingDependencies = await this.repository.listMissingDependenciesForEnable(workspaceId, moduleKey);
    if (missingDependencies.length > 0) {
      throw new AppError(
        `Cannot enable '${moduleKey}'. Missing dependencies: ${missingDependencies.join(", ")}.`,
        "MODULE_DEPENDENCY_MISSING",
        400,
      );
    }

    await this.repository.setWorkspaceModule(workspaceId, moduleKey, true, configuredByUserId);
  }

  public async disableModule(workspaceId: string, moduleKey: string, configuredByUserId: string): Promise<void> {
    const enabledDependents = await this.repository.listEnabledDependents(workspaceId, moduleKey);
    if (enabledDependents.length > 0) {
      throw new AppError(
        `Cannot disable '${moduleKey}'. Dependent modules still enabled: ${enabledDependents.join(", ")}.`,
        "MODULE_DEPENDENT_ENABLED",
        400,
      );
    }

    await this.repository.setWorkspaceModule(workspaceId, moduleKey, false, configuredByUserId);
  }

  public async isModuleEnabledInAnyActiveWorkspace(moduleKey: string): Promise<boolean> {
    return this.repository.isModuleEnabledInAnyActiveWorkspace(moduleKey);
  }

  public async allowModuleForUser(
    workspaceId: string,
    targetUserId: string,
    moduleKey: string,
    configuredByUserId: string,
    reason?: string | null,
  ): Promise<void> {
    await this.repository.setUserModuleOverride(
      workspaceId,
      targetUserId,
      moduleKey,
      "ALLOW",
      configuredByUserId,
      reason,
    );
  }

  public async denyModuleForUser(
    workspaceId: string,
    targetUserId: string,
    moduleKey: string,
    configuredByUserId: string,
    reason?: string | null,
  ): Promise<void> {
    await this.repository.setUserModuleOverride(
      workspaceId,
      targetUserId,
      moduleKey,
      "DENY",
      configuredByUserId,
      reason,
    );
  }

  public async clearUserOverride(workspaceId: string, targetUserId: string, moduleKey: string): Promise<void> {
    await this.repository.clearUserModuleOverride(workspaceId, targetUserId, moduleKey);
  }
}
