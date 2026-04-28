import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { UserModuleState } from "../domain/UserModuleState.js";
import { ModuleAccessRepository } from "../repositories/ModuleAccessRepository.js";
import { WorkspaceModuleState } from "../domain/WorkspaceModuleState.js";

export class PrismaModuleAccessRepository implements ModuleAccessRepository {
  public async isModuleEnabledForUser(workspaceId: string, userId: string, moduleKey: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();

    const moduleRecord = await prisma.module.findFirst({
      where: { key: moduleKey, is_active: true },
      select: { id: true },
    });

    if (!moduleRecord) {
      return false;
    }

    const workspaceModule = await prisma.workspaceModule.findFirst({
      where: {
        workspace_id: workspaceId,
        module_id: moduleRecord.id,
      },
      select: {
        is_enabled: true,
      },
    });

    if (!workspaceModule || workspaceModule.is_enabled === false) {
      return false;
    }

    const override = await prisma.userModuleOverride.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        module_id: moduleRecord.id,
      },
      select: {
        mode: true,
      },
    });

    if (!override) {
      return true;
    }

    return override.mode === "ALLOW";
  }

  public async listWorkspaceModules(workspaceId: string): Promise<WorkspaceModuleState[]> {
    const prisma = PrismaClientManager.getClient();

    const rows = await prisma.workspaceModule.findMany({
      where: {
        workspace_id: workspaceId,
      },
      include: {
        module: {
          select: {
            key: true,
          },
        },
      },
      orderBy: {
        module: {
          key: "asc",
        },
      },
    });

    return rows.map((row) => new WorkspaceModuleState(row.module.key, row.is_enabled));
  }

  public async listUserModules(workspaceId: string, userId: string): Promise<UserModuleState[]> {
    const prisma = PrismaClientManager.getClient();

    const rows = await prisma.workspaceModule.findMany({
      where: {
        workspace_id: workspaceId,
      },
      include: {
        module: {
          select: {
            key: true,
            user_module_overrides: {
              where: {
                workspace_id: workspaceId,
                user_id: userId,
              },
              select: {
                mode: true,
              },
            },
          },
        },
      },
      orderBy: {
        module: {
          key: "asc",
        },
      },
    });

    return rows.map((row) => {
      const override = row.module.user_module_overrides[0]?.mode ?? null;
      const effectiveEnabled = row.is_enabled && (override === null || override === "ALLOW");

      return new UserModuleState({
        moduleKey: row.module.key,
        workspaceEnabled: row.is_enabled,
        overrideMode: override,
        effectiveEnabled,
      });
    });
  }

  public async setWorkspaceModule(
    workspaceId: string,
    moduleKey: string,
    enabled: boolean,
    configuredByUserId: string,
  ): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const moduleRecord = await this.resolveModuleOrThrow(moduleKey);

    await prisma.workspaceModule.upsert({
      where: {
        workspace_id_module_id: {
          workspace_id: workspaceId,
          module_id: moduleRecord.id,
        },
      },
      update: {
        is_enabled: enabled,
        configured_by_user_id: configuredByUserId,
        configured_at: new Date(),
      },
      create: {
        workspace_id: workspaceId,
        module_id: moduleRecord.id,
        is_enabled: enabled,
        configured_by_user_id: configuredByUserId,
      },
    });
  }

  public async setUserModuleOverride(
    workspaceId: string,
    userId: string,
    moduleKey: string,
    mode: "ALLOW" | "DENY",
    configuredByUserId: string,
    reason?: string | null,
  ): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const moduleRecord = await this.resolveModuleOrThrow(moduleKey);

    await this.ensureUserActiveMembership(workspaceId, userId);

    await prisma.userModuleOverride.upsert({
      where: {
        workspace_id_user_id_module_id: {
          workspace_id: workspaceId,
          user_id: userId,
          module_id: moduleRecord.id,
        },
      },
      update: {
        mode,
        reason: reason?.trim() || null,
        configured_by_user_id: configuredByUserId,
        configured_at: new Date(),
      },
      create: {
        workspace_id: workspaceId,
        user_id: userId,
        module_id: moduleRecord.id,
        mode,
        reason: reason?.trim() || null,
        configured_by_user_id: configuredByUserId,
      },
    });
  }

  public async clearUserModuleOverride(workspaceId: string, userId: string, moduleKey: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const moduleRecord = await this.resolveModuleOrThrow(moduleKey);

    await prisma.userModuleOverride.deleteMany({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        module_id: moduleRecord.id,
      },
    });
  }

  public async listMissingDependenciesForEnable(workspaceId: string, moduleKey: string): Promise<string[]> {
    const prisma = PrismaClientManager.getClient();
    const moduleRecord = await this.resolveModuleOrThrow(moduleKey);

    const dependencies = await prisma.moduleDependency.findMany({
      where: {
        module_id: moduleRecord.id,
      },
      include: {
        depends_on_module: {
          select: {
            id: true,
            key: true,
            is_active: true,
          },
        },
      },
    });

    if (dependencies.length === 0) {
      return [];
    }

    const requiredIds = dependencies.map((item) => item.depends_on_module.id);
    const enabledRows = await prisma.workspaceModule.findMany({
      where: {
        workspace_id: workspaceId,
        module_id: {
          in: requiredIds,
        },
        is_enabled: true,
      },
      select: {
        module_id: true,
      },
    });

    const enabledIds = new Set(enabledRows.map((row) => row.module_id));

    return dependencies
      .filter((item) => !item.depends_on_module.is_active || !enabledIds.has(item.depends_on_module.id))
      .map((item) => item.depends_on_module.key);
  }

  public async listEnabledDependents(workspaceId: string, moduleKey: string): Promise<string[]> {
    const prisma = PrismaClientManager.getClient();
    const moduleRecord = await this.resolveModuleOrThrow(moduleKey);

    const dependentLinks = await prisma.moduleDependency.findMany({
      where: {
        depends_on_module_id: moduleRecord.id,
      },
      include: {
        module: {
          select: {
            id: true,
            key: true,
            is_active: true,
          },
        },
      },
    });

    if (dependentLinks.length === 0) {
      return [];
    }

    const dependentIds = dependentLinks
      .filter((item) => item.module.is_active)
      .map((item) => item.module.id);

    if (dependentIds.length === 0) {
      return [];
    }

    const enabledRows = await prisma.workspaceModule.findMany({
      where: {
        workspace_id: workspaceId,
        module_id: {
          in: dependentIds,
        },
        is_enabled: true,
      },
      include: {
        module: {
          select: {
            key: true,
          },
        },
      },
      orderBy: {
        module: {
          key: "asc",
        },
      },
    });

    return enabledRows.map((item) => item.module.key);
  }

  private async resolveModuleOrThrow(moduleKey: string): Promise<{ id: number }> {
    const prisma = PrismaClientManager.getClient();
    const moduleRecord = await prisma.module.findFirst({
      where: {
        key: moduleKey,
        is_active: true,
      },
      select: {
        id: true,
      },
    });

    if (!moduleRecord) {
      throw new AppError(`Module '${moduleKey}' does not exist or is inactive.`, "MODULE_NOT_FOUND", 404);
    }

    return moduleRecord;
  }

  private async ensureUserActiveMembership(workspaceId: string, userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      throw new AppError("Target user is not active in workspace.", "MODULE_USER_NOT_IN_WORKSPACE", 400);
    }
  }
}
