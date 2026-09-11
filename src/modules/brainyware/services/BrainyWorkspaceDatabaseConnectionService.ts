import { Inject, Injectable } from "@nestjs/common";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaService } from "../../../nest/prisma/prisma.service.js";
import { BrainywareClient } from "./BrainywareClient.js";

type AccessMode = "ALL" | "ASSIGNED";

export interface BrainyDatabaseConnectionView {
  id: string;
  brainywareConnectionId: string;
  label: string;
  isEnabled: boolean;
  isWorkflowEnabled: boolean;
  accessMode: AccessMode;
  roleIds: number[];
  roles: Array<{ id: number; label: string }>;
}

@Injectable()
export class BrainyWorkspaceDatabaseConnectionService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BrainywareClient) private readonly client: BrainywareClient,
  ) {}

  public async list(workspaceId: string): Promise<BrainyDatabaseConnectionView[]> {
    const connections = await this.prisma.brainyWorkspaceDatabaseConnection.findMany({
      where: { workspace_id: workspaceId, deleted_at: null },
      include: {
        role_accesses: {
          include: {
            role: { select: { id: true, key: true, label: true } },
          },
          orderBy: { created_at: "asc" },
        },
      },
      orderBy: { label: "asc" },
    });

    return connections.map((connection) => this.toView(connection));
  }

  public async listForUser(
    workspaceId: string,
    userId: string,
  ): Promise<Array<{ id: string; brainywareConnectionId: string; label: string }>> {
    const [connections, userRoles] = await Promise.all([
      this.prisma.brainyWorkspaceDatabaseConnection.findMany({
        where: {
          workspace_id: workspaceId,
          deleted_at: null,
          is_enabled: true,
        },
        include: {
          role_accesses: {
            select: { role_id: true },
          },
        },
        orderBy: { label: "asc" },
      }),
      this.prisma.userWorkspaceRole.findMany({
        where: { workspace_id: workspaceId, user_id: userId },
        select: {
          role_id: true,
          role: { select: { key: true } },
        },
      }),
    ]);

    const hasAdministrativeAccess = userRoles.some(({ role }) =>
      ["developer", "superuser"].includes(role.key),
    );
    const roleIds = new Set(userRoles.map(({ role_id }) => role_id));

    return connections
      .filter((connection) => {
        return (
          hasAdministrativeAccess ||
          connection.access_mode === "ALL" ||
          connection.role_accesses.some((access) => roleIds.has(access.role_id))
        );
      })
      .map((connection) => ({
        id: connection.id,
        brainywareConnectionId: connection.brainyware_connection_id,
        label: connection.label,
      }));
  }

  public async listForWorkflowUser(
    workspaceId: string,
    userId: string,
  ): Promise<Array<{ id: string; brainywareConnectionId: string; label: string }>> {
    const accessibleConnections = await this.listForUser(workspaceId, userId);
    if (accessibleConnections.length === 0) {
      return [];
    }

    const connections = await this.prisma.brainyWorkspaceDatabaseConnection.findMany({
      where: {
        workspace_id: workspaceId,
        id: { in: accessibleConnections.map((connection) => connection.id) },
        deleted_at: null,
        is_enabled: true,
        is_workflow_enabled: true,
      },
      select: {
        id: true,
        brainyware_connection_id: true,
        label: true,
      },
      orderBy: { label: "asc" },
    });

    return connections.map((connection) => ({
      id: connection.id,
      brainywareConnectionId: connection.brainyware_connection_id,
      label: connection.label,
    }));
  }

  public async listAvailable(): Promise<
    Array<{ id: string; label: string; dbType: string | null }>
  > {
    const connections = await this.client.listDatabaseConnections();

    return connections
      .filter((connection) => connection.accessMode?.toUpperCase() === "READ_ONLY")
      .map((connection) => ({
        id: connection.id,
        label: connection.name,
        dbType: connection.dbType,
      }));
  }

  public async accessOptions(
    workspaceId: string,
  ): Promise<{ roles: Array<{ id: number; label: string }> }> {
    const roles = await this.prisma.role.findMany({
      where: {
        key: { in: ["admin", "operator"] },
        user_workspace_roles: {
          some: { workspace_id: workspaceId },
        },
      },
      select: { id: true, key: true, label: true },
      orderBy: { label: "asc" },
    });

    return {
      roles: roles.map((role) => ({
        id: role.id,
        label: role.label || role.key,
      })),
    };
  }

  public async enable(
    workspaceId: string,
    userId: string,
    brainywareConnectionId: string,
  ): Promise<BrainyDatabaseConnectionView> {
    const externalConnectionId = brainywareConnectionId.trim();
    const connection = (await this.client.listDatabaseConnections()).find(
      (candidate) => candidate.id === externalConnectionId,
    );

    if (!connection) {
      throw new AppError(
        "La connessione Brainyware non e' accessibile al service account.",
        "BRAINY_DATABASE_NOT_FOUND",
        404,
      );
    }

    if (connection.accessMode?.toUpperCase() !== "READ_ONLY") {
      throw new AppError(
        "Birgus consente esclusivamente connessioni Brainyware READ_ONLY.",
        "BRAINY_DATABASE_READ_ONLY_REQUIRED",
        409,
      );
    }

    const row = await this.prisma.brainyWorkspaceDatabaseConnection.upsert({
      where: {
        workspace_id_brainyware_connection_id: {
          workspace_id: workspaceId,
          brainyware_connection_id: externalConnectionId,
        },
      },
      create: {
        workspace_id: workspaceId,
        brainyware_connection_id: externalConnectionId,
        label: connection.name,
        is_enabled: true,
        is_workflow_enabled: false,
        created_by_user_id: userId,
      },
      update: {
        label: connection.name,
        is_enabled: true,
        deleted_at: null,
      },
    });

    return {
      id: row.id,
      brainywareConnectionId: row.brainyware_connection_id,
      label: row.label,
      isEnabled: row.is_enabled,
      isWorkflowEnabled: row.is_workflow_enabled,
      accessMode: row.access_mode,
      roleIds: [],
      roles: [],
    };
  }

  public async setEnabled(
    workspaceId: string,
    id: string,
    isEnabled: boolean,
  ): Promise<void> {
    const result = await this.prisma.brainyWorkspaceDatabaseConnection.updateMany({
      where: { id, workspace_id: workspaceId, deleted_at: null },
      data: { is_enabled: isEnabled },
    });

    if (result.count === 0) {
      throw new AppError(
        "Connessione database Brainy non trovata.",
        "BRAINY_DATABASE_NOT_FOUND",
        404,
      );
    }
  }

  public async setAccess(
    workspaceId: string,
    id: string,
    accessMode: AccessMode,
    roleIds: number[],
    isWorkflowEnabled: boolean,
  ): Promise<void> {
    const requestedRoleIds = [...new Set(roleIds)];
    if (requestedRoleIds.some((roleId) => !Number.isInteger(roleId) || roleId < 1)) {
      throw new AppError(
        "I ruoli selezionati non sono validi.",
        "BRAINY_DATABASE_ACCESS_INVALID",
        400,
      );
    }

    const connection = await this.prisma.brainyWorkspaceDatabaseConnection.findFirst({
      where: { id, workspace_id: workspaceId, deleted_at: null },
      select: { id: true },
    });
    if (!connection) {
      throw new AppError(
        "Connessione database Brainy non trovata.",
        "BRAINY_DATABASE_NOT_FOUND",
        404,
      );
    }

    const validRoles = await this.prisma.role.findMany({
      where: {
        id: { in: requestedRoleIds },
        key: { in: ["admin", "operator"] },
        user_workspace_roles: {
          some: { workspace_id: workspaceId },
        },
      },
      select: { id: true },
    });
    if (validRoles.length !== requestedRoleIds.length) {
      throw new AppError(
        "Il ruolo selezionato non e' disponibile nel workspace.",
        "BRAINY_DATABASE_ACCESS_INVALID",
        400,
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.brainyWorkspaceDatabaseConnection.update({
        where: { id },
        data: {
          access_mode: accessMode,
          is_workflow_enabled: isWorkflowEnabled,
        },
      });

      await transaction.brainyWorkspaceDatabaseConnectionRoleAccess.deleteMany({
        where: { workspace_database_connection_id: id },
      });

      if (validRoles.length > 0) {
        await transaction.brainyWorkspaceDatabaseConnectionRoleAccess.createMany({
          data: validRoles.map((role) => ({
            workspace_database_connection_id: id,
            workspace_id: workspaceId,
            role_id: role.id,
          })),
        });
      }
    });
  }

  public async requireForUser(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<{ id: string; brainywareConnectionId: string; label: string }> {
    const connection = (await this.listForUser(workspaceId, userId)).find(
      (candidate) => candidate.id === id,
    );
    if (!connection) {
      throw new AppError(
        "Non hai accesso alla connessione database Brainy selezionata.",
        "BRAINY_DATABASE_ACCESS_DENIED",
        403,
      );
    }

    return connection;
  }

  public async requireBrainywareConnectionForWorkflowUser(
    workspaceId: string,
    userId: string,
    brainywareConnectionId: string,
  ): Promise<{ id: string; brainywareConnectionId: string; label: string }> {
    const connection = (
      await this.listForWorkflowUser(workspaceId, userId)
    ).find(
      (candidate) => candidate.brainywareConnectionId === brainywareConnectionId,
    );
    if (!connection) {
      throw new AppError(
        "La connessione database Brainy selezionata non e' abilitata per questo workflow.",
        "BRAINY_WORKFLOW_DATABASE_ACCESS_DENIED",
        403,
      );
    }

    return connection;
  }

  public async archive(workspaceId: string, id: string): Promise<void> {
    const result = await this.prisma.brainyWorkspaceDatabaseConnection.updateMany({
      where: { id, workspace_id: workspaceId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    if (result.count === 0) {
      throw new AppError(
        "Connessione database Brainy non trovata.",
        "BRAINY_DATABASE_NOT_FOUND",
        404,
      );
    }
  }

  private toView(connection: {
    id: string;
    brainyware_connection_id: string;
    label: string;
    is_enabled: boolean;
    is_workflow_enabled: boolean;
    access_mode: AccessMode;
    role_accesses: Array<{
      role_id: number;
      role: { id: number; key: string; label: string | null };
    }>;
  }): BrainyDatabaseConnectionView {
    return {
      id: connection.id,
      brainywareConnectionId: connection.brainyware_connection_id,
      label: connection.label,
      isEnabled: connection.is_enabled,
      isWorkflowEnabled: connection.is_workflow_enabled,
      accessMode: connection.access_mode,
      roleIds: connection.role_accesses.map((access) => access.role_id),
      roles: connection.role_accesses.map((access) => ({
        id: access.role.id,
        label: access.role.label || access.role.key,
      })),
    };
  }
}
