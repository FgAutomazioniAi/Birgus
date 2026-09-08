import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AppError } from "../../../core/errors/AppError.js";
import { ArchivedItemsService, ArchivedItemDto } from "../../document-archive/services/ArchivedItemsService.js";
import { PasswordHasher } from "../../identity/services/PasswordHasher.js";
import { PasswordPolicy } from "../../identity/services/PasswordPolicy.js";
import { AuthSessionRepository } from "../../identity/repositories/AuthSessionRepository.js";
import { ModuleManagementService } from "../../module-management/services/ModuleManagementService.js";
import { AuditLogService } from "../../audit/services/AuditLogService.js";
import { ModuleOverrideMode } from "@prisma/client";

interface AuditContext {
  actorUserId: string;
  actorWorkspaceId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type ManagementScope = "GLOBAL" | "WORKSPACE";

export class SuperadminService {
  private readonly archivedItemsService: ArchivedItemsService;
  private readonly passwordHasher: PasswordHasher;
  private readonly passwordPolicy: PasswordPolicy;
  private readonly authSessionRepository: AuthSessionRepository;
  private readonly moduleManagementService: ModuleManagementService;
  private readonly auditLogService: AuditLogService;

  public constructor(params: {
    archivedItemsService: ArchivedItemsService;
    passwordHasher: PasswordHasher;
    passwordPolicy: PasswordPolicy;
    authSessionRepository: AuthSessionRepository;
    moduleManagementService: ModuleManagementService;
    auditLogService: AuditLogService;
  }) {
    this.archivedItemsService = params.archivedItemsService;
    this.passwordHasher = params.passwordHasher;
    this.passwordPolicy = params.passwordPolicy;
    this.authSessionRepository = params.authSessionRepository;
    this.moduleManagementService = params.moduleManagementService;
    this.auditLogService = params.auditLogService;
  }

  public async resolveManagementScope(userId: string, workspaceId: string): Promise<ManagementScope> {
    const prisma = PrismaClientManager.getClient();
    const developerAssignment = await prisma.userWorkspaceRole.findFirst({
      where: {
        user_id: userId,
        role: { key: "developer" },
      },
      select: { id: true },
    });
    if (developerAssignment) return "GLOBAL";

    const superuserAssignment = await prisma.userWorkspaceRole.findFirst({
      where: { user_id: userId, workspace_id: workspaceId, role: { key: "superuser" } },
      select: { id: true },
    });
    if (superuserAssignment) return "WORKSPACE";

    throw new AppError("Accesso consentito solo a Developer o Superuser.", "WORKSPACE_MANAGEMENT_FORBIDDEN", 403);
  }

  public assertWorkspaceInScope(scope: ManagementScope, actorWorkspaceId: string, targetWorkspaceId: string): void {
    if (scope === "WORKSPACE" && actorWorkspaceId !== targetWorkspaceId) {
      throw new AppError("Il Superuser puo gestire solo il proprio workspace.", "WORKSPACE_MANAGEMENT_SCOPE_DENIED", 403);
    }
  }

  public assertGlobalScope(scope: ManagementScope): void {
    if (scope !== "GLOBAL") {
      throw new AppError("Operazione riservata al Developer.", "DEVELOPER_ONLY", 403);
    }
  }

  public async assertRoleAssignable(scope: ManagementScope, roleKey: string, targetUserId?: string): Promise<void> {
    if (roleKey !== "developer") return;

    if (scope === "WORKSPACE") {
      throw new AppError("Solo un Developer puo assegnare il ruolo Developer.", "DEVELOPER_ROLE_ASSIGNMENT_FORBIDDEN", 403);
    }

    const existingDeveloper = await PrismaClientManager.getClient().userWorkspaceRole.findFirst({
      where: {
        role: { key: "developer" },
        ...(targetUserId ? { user_id: { not: targetUserId } } : {}),
      },
      select: { id: true },
    });
    if (existingDeveloper) {
      throw new AppError("L'istanza puo avere un solo account Developer.", "DEVELOPER_ROLE_SINGLETON", 409);
    }
  }

  public async assertUserInScope(scope: ManagementScope, actorWorkspaceId: string, targetUserId: string): Promise<void> {
    if (scope === "GLOBAL") return;
    const prisma = PrismaClientManager.getClient();
    const [membership, developerAssignment] = await Promise.all([
      prisma.workspaceMembership.findFirst({
        where: { workspace_id: actorWorkspaceId, user_id: targetUserId, status: "ACTIVE" },
        select: { id: true },
      }),
      prisma.userWorkspaceRole.findFirst({
        where: { user_id: targetUserId, role: { key: "developer" } },
        select: { id: true },
      }),
    ]);
    if (!membership || developerAssignment) {
      throw new AppError("Il Superuser non puo gestire questo utente.", "WORKSPACE_USER_MANAGEMENT_SCOPE_DENIED", 403);
    }
  }

  public async assertUserAccountInScope(scope: ManagementScope, actorWorkspaceId: string, targetUserId: string): Promise<void> {
    await this.assertUserInScope(scope, actorWorkspaceId, targetUserId);
    if (scope === "GLOBAL") return;

    const prisma = PrismaClientManager.getClient();
    const otherMembership = await prisma.workspaceMembership.findFirst({
      where: {
        user_id: targetUserId,
        status: "ACTIVE",
        workspace_id: { not: actorWorkspaceId },
      },
      select: { id: true },
    });
    if (otherMembership) {
      throw new AppError(
        "Le credenziali di un utente condiviso tra workspace possono essere gestite solo dal Developer.",
        "SHARED_USER_ACCOUNT_MANAGEMENT_FORBIDDEN",
        403,
      );
    }
  }

  public async listWorkspaces(onlyWorkspaceId?: string | null): Promise<Array<{
    id: string;
    code: string;
    name: string;
    organizationCode: string;
    organizationName: string;
    isActive: boolean;
  }>> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.workspace.findMany({
      where: {
        deleted_at: null,
        ...(onlyWorkspaceId ? { id: onlyWorkspaceId } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        is_active: true,
        organization: {
          select: {
            code: true,
            legal_name: true,
          },
        },
      },
      orderBy: [{ organization: { code: "asc" } }, { code: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      organizationCode: row.organization.code,
      organizationName: row.organization.legal_name,
      isActive: row.is_active,
    }));
  }

  public async listRoles(includeDeveloper: boolean): Promise<Array<{ key: string; label: string }>> {
    const prisma = PrismaClientManager.getClient();
    const roles = await prisma.role.findMany({
      where: includeDeveloper ? undefined : { key: { not: "developer" } },
      select: {
        key: true,
        label: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return roles;
  }

  public async listModules(): Promise<Array<{ key: string; name: string }>> {
    const prisma = PrismaClientManager.getClient();
    const modules = await prisma.module.findMany({
      where: {
        is_active: true,
      },
      select: {
        key: true,
        name: true,
      },
      orderBy: {
        key: "asc",
      },
    });

    return modules;
  }

  public async listWorkspaceModules(workspaceId: string): Promise<Array<{
    moduleKey: string;
    enabled: boolean;
  }>> {
    await this.ensureWorkspaceExists(workspaceId);
    const modules = await this.moduleManagementService.listWorkspaceModules(workspaceId);
    return modules.map((item) => ({
      moduleKey: item.moduleKey,
      enabled: item.enabled,
    }));
  }

  public async listUsers(searchText?: string | null, workspaceId?: string | null, includeDevelopers = true): Promise<Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
    isActive: boolean;
    workspaceCount: number;
    developer: boolean;
    superuser: boolean;
  }>> {
    const prisma = PrismaClientManager.getClient();
    const search = searchText?.trim() ?? "";

    const rows = await prisma.user.findMany({
      where: {
        deleted_at: null,
        ...(!includeDevelopers ? { user_workspace_roles: { none: { role: { key: "developer" } } } } : {}),
        ...(search
          ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
            ],
          }
          : {}),
        ...(workspaceId
          ? {
            memberships: {
              some: {
                workspace_id: workspaceId,
                status: "ACTIVE",
              },
            },
          }
          : {}),
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        is_active: true,
        memberships: {
          where: {
            status: "ACTIVE",
          },
          select: {
            workspace_id: true,
          },
        },
        user_workspace_roles: {
          select: {
            role: {
              select: {
                key: true,
              },
            },
          },
        },
      },
      orderBy: [{ first_name: "asc" }, { last_name: "asc" }, { email: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      isActive: row.is_active,
      workspaceCount: new Set(row.memberships.map((item) => item.workspace_id)).size,
      developer: row.user_workspace_roles.some((entry) => entry.role.key === "developer"),
      superuser: row.user_workspace_roles.some((entry) => entry.role.key === "superuser"),
    }));
  }

  public async listUserMemberships(userId: string, onlyWorkspaceId?: string | null): Promise<Array<{
    workspaceId: string;
    workspaceCode: string;
    workspaceName: string;
    status: string;
    roleKeys: string[];
  }>> {
    const prisma = PrismaClientManager.getClient();
    const memberships = await prisma.workspaceMembership.findMany({
      where: {
        user_id: userId,
        ...(onlyWorkspaceId ? { workspace_id: onlyWorkspaceId } : {}),
      },
      select: {
        status: true,
        workspace: {
          select: {
            id: true,
            code: true,
            name: true,
            user_workspace_roles: {
              where: {
                user_id: userId,
              },
              select: {
                role: {
                  select: {
                    key: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        workspace: {
          code: "asc",
        },
      },
    });

    return memberships.map((row) => ({
      workspaceId: row.workspace.id,
      workspaceCode: row.workspace.code,
      workspaceName: row.workspace.name,
      status: row.status,
      roleKeys: row.workspace.user_workspace_roles.map((item) => item.role.key),
    }));
  }

  public async listUserModules(params: {
    workspaceId: string;
    userId: string;
  }): Promise<Array<{
    moduleKey: string;
    workspaceEnabled: boolean;
    overrideMode: ModuleOverrideMode | null;
    effectiveEnabled: boolean;
  }>> {
    const modules = await this.moduleManagementService.listUserModules(params.workspaceId, params.userId);
    return modules.map((item) => ({
      moduleKey: item.moduleKey,
      workspaceEnabled: item.workspaceEnabled,
      overrideMode: item.overrideMode,
      effectiveEnabled: item.effectiveEnabled,
    }));
  }

  public async createUserInWorkspace(params: {
    workspaceId: string;
    email: string;
    firstName: string;
    lastName?: string | null;
    password: string;
    roleKeys: string[];
    auditContext: AuditContext;
  }): Promise<{ userId: string; email: string }> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureWorkspaceExists(params.workspaceId);

    const normalizedEmail = params.email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new AppError("Email obbligatoria.", "SUPERADMIN_CREATE_USER_EMAIL_REQUIRED", 400);
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        deleted_at: true,
      },
    });

    if (existingUser && !existingUser.deleted_at) {
      throw new AppError("Esiste gia un utente con questa email.", "SUPERADMIN_USER_ALREADY_EXISTS", 409);
    }

    const roleKeys = [...new Set(params.roleKeys.map((item) => item.trim()).filter(Boolean))];
    if (roleKeys.length !== 1) {
      throw new AppError("Seleziona un solo ruolo.", "SUPERADMIN_SINGLE_ROLE_REQUIRED", 400);
    }

    const roles = await prisma.role.findMany({
      where: {
        key: {
          in: roleKeys,
        },
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (roles.length !== roleKeys.length) {
      throw new AppError("Uno o piu ruoli non esistono.", "SUPERADMIN_ROLE_UNKNOWN", 400);
    }

    const passwordHash = await this.passwordHasher.hashPassword(this.passwordPolicy.ensureValid(params.password));

    const created = await prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            first_name: params.firstName.trim(),
            last_name: params.lastName?.trim() || null,
            password_hash: passwordHash,
            password_updated_at: new Date(),
            must_change_password: true,
            is_active: true,
            deleted_at: null,
          },
          select: {
            id: true,
            email: true,
          },
        })
        : await tx.user.create({
          data: {
            first_name: params.firstName.trim(),
            last_name: params.lastName?.trim() || null,
            email: normalizedEmail,
            password_hash: passwordHash,
            must_change_password: true,
            is_active: true,
          },
          select: {
            id: true,
            email: true,
          },
        });

      await tx.workspaceMembership.upsert({
        where: {
          workspace_id_user_id: {
            workspace_id: params.workspaceId,
            user_id: user.id,
          },
        },
        update: {
          status: "ACTIVE",
          left_at: null,
        },
        create: {
          workspace_id: params.workspaceId,
          user_id: user.id,
          status: "ACTIVE",
        },
      });

      await tx.userWorkspaceRole.deleteMany({
        where: {
          workspace_id: params.workspaceId,
          user_id: user.id,
        },
      });

      for (const role of roles) {
        await tx.userWorkspaceRole.create({
          data: {
            workspace_id: params.workspaceId,
            user_id: user.id,
            role_id: role.id,
          },
        });
      }

      await tx.userPreference.upsert({
        where: {
          user_id_workspace_id: {
            user_id: user.id,
            workspace_id: params.workspaceId,
          },
        },
        update: {},
        create: {
          user_id: user.id,
          workspace_id: params.workspaceId,
          palette_id: "predefinito",
          language_code: "it",
        },
      });

      return user;
    });

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.user.created",
      entityType: "User",
      entityId: created.id,
      payload: {
        workspaceId: params.workspaceId,
        email: created.email,
        roleKeys,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });

    return {
      userId: created.id,
      email: created.email,
    };
  }

  public async setUserActiveStatus(params: {
    targetUserId: string;
    isActive: boolean;
    auditContext: AuditContext;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const target = await prisma.user.findFirst({
      where: {
        id: params.targetUserId,
        deleted_at: null,
      },
      select: {
        id: true,
        is_active: true,
      },
    });

    if (!target) {
      throw new AppError("Utente non trovato.", "SUPERADMIN_USER_NOT_FOUND", 404);
    }

    if (params.auditContext.actorUserId === params.targetUserId && !params.isActive) {
      throw new AppError("Non puoi disattivare il tuo account.", "SUPERADMIN_SELF_DEACTIVATE_FORBIDDEN", 400);
    }

    if (target.is_active === params.isActive) {
      return;
    }

    if (!params.isActive) {
      const isTargetDeveloper = await prisma.userWorkspaceRole.findFirst({
        where: {
          user_id: params.targetUserId,
          role: {
            key: "developer",
          },
        },
        select: {
          id: true,
        },
      });

      if (isTargetDeveloper) {
        const activeDevelopers = await prisma.user.findMany({
          where: {
            deleted_at: null,
            is_active: true,
            user_workspace_roles: {
              some: {
                role: {
                  key: "developer",
                },
              },
            },
          },
          select: {
            id: true,
          },
        });

        if (activeDevelopers.length <= 1) {
          throw new AppError(
            "Non puoi disattivare l'ultimo Developer attivo.",
            "LAST_DEVELOPER_FORBIDDEN",
            400,
          );
        }
      }
    }

    await prisma.user.update({
      where: {
        id: params.targetUserId,
      },
      data: {
        is_active: params.isActive,
      },
    });

    if (!params.isActive) {
      await this.authSessionRepository.revokeAllForUser(params.targetUserId);
    }

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: params.isActive ? "superadmin.user.activated" : "superadmin.user.deactivated",
      entityType: "User",
      entityId: params.targetUserId,
      payload: {
        isActive: params.isActive,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async addUserToWorkspace(params: {
    workspaceId: string;
    targetUserId: string;
    roleKey: string;
    auditContext: AuditContext;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureWorkspaceExists(params.workspaceId);
    await this.ensureUserExists(params.targetUserId);

    const roleKey = params.roleKey.trim();
    const role = await prisma.role.findUnique({
      where: {
        key: roleKey,
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (!role) {
      throw new AppError("Ruolo non trovato.", "SUPERADMIN_ROLE_UNKNOWN", 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.workspaceMembership.upsert({
        where: {
          workspace_id_user_id: {
            workspace_id: params.workspaceId,
            user_id: params.targetUserId,
          },
        },
        update: {
          status: "ACTIVE",
          left_at: null,
        },
        create: {
          workspace_id: params.workspaceId,
          user_id: params.targetUserId,
          status: "ACTIVE",
        },
      });

      await tx.userWorkspaceRole.deleteMany({
        where: {
          workspace_id: params.workspaceId,
          user_id: params.targetUserId,
        },
      });

      await tx.userWorkspaceRole.create({
        data: {
          workspace_id: params.workspaceId,
          user_id: params.targetUserId,
          role_id: role.id,
        },
      });

      await tx.userPreference.upsert({
        where: {
          user_id_workspace_id: {
            user_id: params.targetUserId,
            workspace_id: params.workspaceId,
          },
        },
        update: {},
        create: {
          user_id: params.targetUserId,
          workspace_id: params.workspaceId,
          palette_id: "predefinito",
          language_code: "it",
        },
      });
    });

    if (role.key === "developer") {
      await this.authSessionRepository.revokeAllForUser(params.targetUserId);
    }

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.user.workspace_added",
      entityType: "WorkspaceMembership",
      entityId: params.targetUserId,
      payload: {
        workspaceId: params.workspaceId,
        targetUserId: params.targetUserId,
        roleKey: role.key,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async resetUserPassword(params: {
    targetUserId: string;
    newPassword: string;
    auditContext: AuditContext;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureUserExists(params.targetUserId);

    const passwordHash = await this.passwordHasher.hashPassword(this.passwordPolicy.ensureValid(params.newPassword));
    await prisma.user.update({
      where: {
        id: params.targetUserId,
      },
      data: {
        password_hash: passwordHash,
        password_updated_at: new Date(),
        must_change_password: true,
      },
    });

    await this.authSessionRepository.revokeAllForUser(params.targetUserId);
    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.user.password_reset",
      entityType: "User",
      entityId: params.targetUserId,
      payload: {
        forced: true,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async revokeUserSessions(params: {
    targetUserId: string;
    auditContext: AuditContext;
  }): Promise<void> {
    await this.ensureUserExists(params.targetUserId);
    await this.authSessionRepository.revokeAllForUser(params.targetUserId);

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.user.sessions_revoked",
      entityType: "User",
      entityId: params.targetUserId,
      payload: {
        scope: "all",
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async resetUserTwoFactor(params: {
    targetUserId: string;
    auditContext: AuditContext;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureUserExists(params.targetUserId);

    await prisma.user.update({
      where: {
        id: params.targetUserId,
      },
      data: {
        two_factor_enabled: false,
        two_factor_secret_ciphertext: null,
        two_factor_enabled_at: null,
        two_factor_last_verified_at: null,
      },
    });

    await this.authSessionRepository.revokeAllForUser(params.targetUserId);
    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.user.two_factor_reset",
      entityType: "User",
      entityId: params.targetUserId,
      payload: {
        forced: true,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async setModuleOverride(params: {
    workspaceId: string;
    targetUserId: string;
    moduleKey: string;
    mode: ModuleOverrideMode;
    reason?: string | null;
    auditContext: AuditContext;
  }): Promise<void> {
    await this.ensureWorkspaceExists(params.workspaceId);
    if (params.mode === "ALLOW") {
      await this.moduleManagementService.allowModuleForUser(
        params.workspaceId,
        params.targetUserId,
        params.moduleKey,
        params.auditContext.actorUserId,
        params.reason ?? null,
      );
    } else {
      await this.moduleManagementService.denyModuleForUser(
        params.workspaceId,
        params.targetUserId,
        params.moduleKey,
        params.auditContext.actorUserId,
        params.reason ?? null,
      );
    }

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.module.override_set",
      entityType: "UserModuleOverride",
      entityId: params.targetUserId,
      payload: {
        workspaceId: params.workspaceId,
        targetUserId: params.targetUserId,
        moduleKey: params.moduleKey,
        mode: params.mode,
        reason: params.reason ?? null,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async setWorkspaceModule(params: {
    workspaceId: string;
    moduleKey: string;
    enabled: boolean;
    auditContext: AuditContext;
  }): Promise<void> {
    await this.ensureWorkspaceExists(params.workspaceId);
    if (params.enabled) {
      await this.moduleManagementService.enableModule(
        params.workspaceId,
        params.moduleKey,
        params.auditContext.actorUserId,
      );
    } else {
      await this.moduleManagementService.disableModule(
        params.workspaceId,
        params.moduleKey,
        params.auditContext.actorUserId,
      );
    }

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: params.enabled ? "superadmin.workspace.module_enabled" : "superadmin.workspace.module_disabled",
      entityType: "WorkspaceModule",
      entityId: params.workspaceId,
      payload: {
        workspaceId: params.workspaceId,
        moduleKey: params.moduleKey,
        enabled: params.enabled,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async deleteWorkspace(params: {
    workspaceId: string;
    confirmText: string;
    auditContext: AuditContext;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    if (params.workspaceId === params.auditContext.actorWorkspaceId) {
      throw new AppError(
        "Non puoi cancellare il workspace da cui stai operando.",
        "SUPERADMIN_DELETE_CURRENT_WORKSPACE_FORBIDDEN",
        400,
      );
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: params.workspaceId,
        deleted_at: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        organization_id: true,
      },
    });

    if (!workspace) {
      throw new AppError("Workspace non trovato.", "SUPERADMIN_WORKSPACE_NOT_FOUND", 404);
    }

    if (params.confirmText.trim() !== workspace.code) {
      throw new AppError(
        `Conferma eliminazione non valida: digita '${workspace.code}'.`,
        "SUPERADMIN_WORKSPACE_DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    await prisma.workspace.update({
      where: {
        id: workspace.id,
      },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
    });

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.workspace.deleted",
      entityType: "Workspace",
      entityId: workspace.id,
      payload: {
        workspaceId: workspace.id,
        workspaceCode: workspace.code,
        workspaceName: workspace.name,
        organizationId: workspace.organization_id,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async clearModuleOverride(params: {
    workspaceId: string;
    targetUserId: string;
    moduleKey: string;
    auditContext: AuditContext;
  }): Promise<void> {
    await this.ensureWorkspaceExists(params.workspaceId);
    await this.moduleManagementService.clearUserOverride(
      params.workspaceId,
      params.targetUserId,
      params.moduleKey,
    );

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.module.override_cleared",
      entityType: "UserModuleOverride",
      entityId: params.targetUserId,
      payload: {
        workspaceId: params.workspaceId,
        targetUserId: params.targetUserId,
        moduleKey: params.moduleKey,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async replaceWorkspaceRoles(params: {
    workspaceId: string;
    targetUserId: string;
    roleKeys: string[];
    auditContext: AuditContext;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await this.ensureWorkspaceExists(params.workspaceId);
    await this.ensureUserExists(params.targetUserId);
    await this.ensureActiveMembership(params.workspaceId, params.targetUserId);

    const deduplicatedRoleKeys = [...new Set(params.roleKeys.map((item) => item.trim()).filter(Boolean))];
    if (deduplicatedRoleKeys.length !== 1) {
      throw new AppError("Un solo ruolo deve rimanere assegnato.", "SUPERADMIN_SINGLE_ROLE_REQUIRED", 400);
    }

    const roles = await prisma.role.findMany({
      where: {
        key: {
          in: deduplicatedRoleKeys,
        },
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (roles.length !== deduplicatedRoleKeys.length) {
      throw new AppError("Uno o piu ruoli non esistono.", "SUPERADMIN_ROLE_UNKNOWN", 400);
    }

    if (!deduplicatedRoleKeys.includes("developer")) {
      const [workspaceDeveloperAssignment, otherDeveloperAssignment] = await Promise.all([
        prisma.userWorkspaceRole.findFirst({
          where: {
            workspace_id: params.workspaceId,
            user_id: params.targetUserId,
            role: { key: "developer" },
          },
          select: { id: true },
        }),
        prisma.userWorkspaceRole.findFirst({
          where: {
            workspace_id: { not: params.workspaceId },
            user_id: params.targetUserId,
            role: { key: "developer" },
          },
          select: { id: true },
        }),
      ]);
      if (workspaceDeveloperAssignment && !otherDeveloperAssignment) {
        throw new AppError(
          "Non puoi rimuovere l'ultima assegnazione del Developer.",
          "LAST_DEVELOPER_ROLE_FORBIDDEN",
          409,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.userWorkspaceRole.deleteMany({
        where: {
          workspace_id: params.workspaceId,
          user_id: params.targetUserId,
        },
      });

      for (const role of roles) {
        await tx.userWorkspaceRole.create({
          data: {
            workspace_id: params.workspaceId,
            user_id: params.targetUserId,
            role_id: role.id,
          },
        });
      }
    });

    if (deduplicatedRoleKeys.includes("developer")) {
      await this.authSessionRepository.revokeAllForUser(params.targetUserId);
    }

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.roles.replaced",
      entityType: "UserWorkspaceRole",
      entityId: params.targetUserId,
      payload: {
        workspaceId: params.workspaceId,
        targetUserId: params.targetUserId,
        roleKeys: deduplicatedRoleKeys,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async restoreArchivedItem(params: {
    workspaceId: string;
    entityType: ArchivedItemDto["entityType"];
    entityId: string;
    auditContext: AuditContext;
  }): Promise<void> {
    await this.ensureWorkspaceExists(params.workspaceId);
    await this.archivedItemsService.restoreArchivedItem({
      workspaceId: params.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
    });

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.archive.restore",
      entityType: params.entityType,
      entityId: params.entityId,
      payload: {
        workspaceId: params.workspaceId,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  public async permanentlyDeleteArchivedItem(params: {
    workspaceId: string;
    entityType: ArchivedItemDto["entityType"];
    entityId: string;
    reason: string;
    auditContext: AuditContext;
  }): Promise<void> {
    await this.ensureWorkspaceExists(params.workspaceId);
    await this.archivedItemsService.permanentlyDeleteArchivedItem({
      workspaceId: params.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
    });

    await this.auditLogService.record({
      workspaceId: params.auditContext.actorWorkspaceId,
      userId: params.auditContext.actorUserId,
      moduleKey: "superadmin_center",
      action: "superadmin.archive.hard_delete",
      entityType: params.entityType,
      entityId: params.entityId,
      payload: {
        workspaceId: params.workspaceId,
        reason: params.reason,
      },
      ipAddress: params.auditContext.ipAddress ?? null,
      userAgent: params.auditContext.userAgent ?? null,
    });
  }

  private async ensureWorkspaceExists(workspaceId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (!workspace) {
      throw new AppError("Workspace non trovato.", "SUPERADMIN_WORKSPACE_NOT_FOUND", 404);
    }
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new AppError("Utente non trovato.", "SUPERADMIN_USER_NOT_FOUND", 404);
    }
  }

  private async ensureActiveMembership(workspaceId: string, userId: string): Promise<void> {
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
      throw new AppError("Utente non attivo nel workspace selezionato.", "SUPERADMIN_USER_NOT_IN_WORKSPACE", 400);
    }
  }
}
