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

  public async assertSuperadmin(userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const roleAssignment = await prisma.userWorkspaceRole.findFirst({
      where: {
        user_id: userId,
        role: {
          key: "superadmin",
        },
      },
      select: {
        id: true,
      },
    });

    if (!roleAssignment) {
      throw new AppError("Accesso consentito solo a superadmin.", "SUPERADMIN_ONLY", 403);
    }
  }

  public async listWorkspaces(): Promise<Array<{
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

  public async listRoles(): Promise<Array<{ key: string; label: string }>> {
    const prisma = PrismaClientManager.getClient();
    const roles = await prisma.role.findMany({
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

  public async listUsers(searchText?: string | null, workspaceId?: string | null): Promise<Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
    isActive: boolean;
    workspaceCount: number;
    superadmin: boolean;
  }>> {
    const prisma = PrismaClientManager.getClient();
    const search = searchText?.trim() ?? "";

    const rows = await prisma.user.findMany({
      where: {
        deleted_at: null,
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
      superadmin: row.user_workspace_roles.some((entry) => entry.role.key === "superadmin"),
    }));
  }

  public async listUserMemberships(userId: string): Promise<Array<{
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
    if (roleKeys.length === 0) {
      throw new AppError("Seleziona almeno un ruolo.", "SUPERADMIN_ROLE_SET_EMPTY", 400);
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
      const isTargetSuperadmin = await prisma.userWorkspaceRole.findFirst({
        where: {
          user_id: params.targetUserId,
          role: {
            key: "superadmin",
          },
        },
        select: {
          id: true,
        },
      });

      if (isTargetSuperadmin) {
        const activeSuperadmins = await prisma.user.findMany({
          where: {
            deleted_at: null,
            is_active: true,
            user_workspace_roles: {
              some: {
                role: {
                  key: "superadmin",
                },
              },
            },
          },
          select: {
            id: true,
          },
        });

        if (activeSuperadmins.length <= 1) {
          throw new AppError(
            "Non puoi disattivare l'ultimo superadmin attivo.",
            "SUPERADMIN_LAST_SUPERADMIN_FORBIDDEN",
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
    if (deduplicatedRoleKeys.length === 0) {
      throw new AppError("Almeno un ruolo deve rimanere assegnato.", "SUPERADMIN_ROLE_SET_EMPTY", 400);
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
