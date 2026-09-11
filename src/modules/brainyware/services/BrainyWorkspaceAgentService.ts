import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaService } from "../../../nest/prisma/prisma.service.js";
import { BrainywareClient } from "./BrainywareClient.js";

export type BrainyAgentAccessMode = "ALL" | "ASSIGNED";

export interface BrainyWorkspaceAgentAssignmentView {
  id: number;
  label: string;
}

export interface BrainyWorkspaceAgentView {
  id: string;
  brainywareAgentId: string;
  label: string;
  isEnabled: boolean;
  isDefault: boolean;
  isWorkflowEnabled: boolean;
  accessMode: BrainyAgentAccessMode;
  assignments: BrainyWorkspaceAgentAssignmentView[];
  createdAt: string;
  updatedAt: string;
}

export interface BrainyAgentAccessOptions {
  roles: Array<{ id: number; label: string }>;
}

interface UpsertBrainyWorkspaceAgentInput {
  brainywareAgentId: string;
  label: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  isWorkflowEnabled?: boolean;
  accessMode?: BrainyAgentAccessMode;
  roleIds?: number[];
}

const agentInclude = Prisma.validator<Prisma.BrainyWorkspaceAgentInclude>()({
  assignments: {
    include: {
      role: {
        select: {
          id: true,
          key: true,
          label: true,
        },
      },
    },
    orderBy: {
      created_at: "asc",
    },
  },
});

type AgentWithAssignments = Prisma.BrainyWorkspaceAgentGetPayload<{
  include: typeof agentInclude;
}>;

@Injectable()
export class BrainyWorkspaceAgentService {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BrainywareClient) private readonly client: BrainywareClient,
  ) {}

  public async listAvailable(): Promise<Array<{ id: string; label: string }>> {
    const agents = await this.client.listAgents();

    return agents.map((agent) => ({ id: agent.id, label: agent.name }));
  }

  public async list(workspaceId: string): Promise<BrainyWorkspaceAgentView[]> {
    const rows = await this.prisma.brainyWorkspaceAgent.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
      },
      include: agentInclude,
      orderBy: [
        { is_default: "desc" },
        { label: "asc" },
        { created_at: "asc" },
      ],
    });

    return rows.map((row) => this.toView(row));
  }

  public async listForUser(
    workspaceId: string,
    userId: string,
  ): Promise<Array<{ id: string; label: string; isDefault: boolean }>> {
    const [agents, userRoles] = await Promise.all([
      this.prisma.brainyWorkspaceAgent.findMany({
        where: {
          workspace_id: workspaceId,
          deleted_at: null,
          is_enabled: true,
        },
        include: {
          assignments: {
            select: {
              role_id: true,
            },
          },
        },
        orderBy: [{ is_default: "desc" }, { label: "asc" }],
      }),
      this.prisma.userWorkspaceRole.findMany({
        where: {
          workspace_id: workspaceId,
          user_id: userId,
        },
        select: {
          role_id: true,
          role: {
            select: {
              key: true,
            },
          },
        },
      }),
    ]);

    const hasAdministrativeAccess = userRoles.some(({ role }) =>
      ["developer", "superuser"].includes(role.key),
    );
    const roleIds = new Set(userRoles.map(({ role_id }) => role_id));

    return agents
      .filter((agent) => {
        return (
          hasAdministrativeAccess ||
          agent.access_mode === "ALL" ||
          agent.assignments.some(
            (assignment) =>
              assignment.role_id !== null && roleIds.has(assignment.role_id),
          )
        );
      })
      .map((agent) => ({
        id: agent.id,
        label: agent.label,
        isDefault: agent.is_default,
      }));
  }

  public async listForWorkflowUser(
    workspaceId: string,
    userId: string,
  ): Promise<Array<{ id: string; label: string }>> {
    const availableAgents = await this.listForUser(workspaceId, userId);
    if (availableAgents.length === 0) {
      return [];
    }

    return this.prisma.brainyWorkspaceAgent.findMany({
      where: {
        workspace_id: workspaceId,
        id: {
          in: availableAgents.map((agent) => agent.id),
        },
        deleted_at: null,
        is_enabled: true,
        is_workflow_enabled: true,
      },
      select: {
        id: true,
        label: true,
      },
      orderBy: {
        label: "asc",
      },
    });
  }

  public async requireWorkflowAgentForUser(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<{ id: string; label: string; brainywareAgentId: string }> {
    const availableAgents = await this.listForWorkflowUser(workspaceId, userId);
    if (!availableAgents.some((agent) => agent.id === id)) {
      throw new AppError(
        "L'agente Brainy selezionato non e' disponibile per questo workflow.",
        "BRAINY_WORKFLOW_AGENT_ACCESS_DENIED",
        403,
      );
    }

    const agent = await this.prisma.brainyWorkspaceAgent.findFirst({
      where: {
        id,
        workspace_id: workspaceId,
        deleted_at: null,
        is_enabled: true,
        is_workflow_enabled: true,
      },
      select: {
        id: true,
        label: true,
        brainyware_agent_id: true,
      },
    });

    if (!agent) {
      throw new AppError(
        "L'agente Brainy selezionato non e' disponibile per questo workflow.",
        "BRAINY_WORKFLOW_AGENT_ACCESS_DENIED",
        403,
      );
    }

    return {
      id: agent.id,
      label: agent.label,
      brainywareAgentId: agent.brainyware_agent_id,
    };
  }

  public async accessOptions(
    workspaceId: string,
  ): Promise<BrainyAgentAccessOptions> {
    const roles = await this.prisma.role.findMany({
      where: {
        key: {
          in: ["admin", "operator"],
        },
        user_workspace_roles: {
          some: {
            workspace_id: workspaceId,
          },
        },
      },
      select: {
        id: true,
        key: true,
        label: true,
      },
      orderBy: {
        label: "asc",
      },
    });

    return {
      roles: roles.map((role) => ({
        id: role.id,
        label: role.label || role.key,
      })),
    };
  }

  public async create(
    workspaceId: string,
    userId: string,
    input: UpsertBrainyWorkspaceAgentInput,
  ): Promise<BrainyWorkspaceAgentView> {
    const value = this.validateInput(input);
    const row = await this.prisma.$transaction(async (transaction) => {
      if (value.isDefault) {
        await transaction.brainyWorkspaceAgent.updateMany({
          where: {
            workspace_id: workspaceId,
            deleted_at: null,
          },
          data: {
            is_default: false,
            updated_by_user_id: userId,
          },
        });
      }

      const existing = await transaction.brainyWorkspaceAgent.findUnique({
        where: {
          workspace_id_brainyware_agent_id: {
            workspace_id: workspaceId,
            brainyware_agent_id: value.brainywareAgentId,
          },
        },
      });

      const agent = existing
        ? await transaction.brainyWorkspaceAgent.update({
            where: { id: existing.id },
            data: {
              label: value.label,
              is_enabled: value.isEnabled,
              is_default: value.isDefault,
              is_workflow_enabled: value.isWorkflowEnabled,
              access_mode: value.accessMode,
              deleted_at: null,
              updated_by_user_id: userId,
            },
          })
        : await transaction.brainyWorkspaceAgent.create({
            data: {
              workspace_id: workspaceId,
              brainyware_agent_id: value.brainywareAgentId,
              label: value.label,
              is_enabled: value.isEnabled,
              is_default: value.isDefault,
              is_workflow_enabled: value.isWorkflowEnabled,
              access_mode: value.accessMode,
              created_by_user_id: userId,
              updated_by_user_id: userId,
            },
          });

      await this.syncRoleAssignments(
        transaction,
        workspaceId,
        agent.id,
        value.roleIds,
      );

      return transaction.brainyWorkspaceAgent.findUniqueOrThrow({
        where: { id: agent.id },
        include: agentInclude,
      });
    });

    return this.toView(row);
  }

  public async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpsertBrainyWorkspaceAgentInput,
  ): Promise<BrainyWorkspaceAgentView> {
    const value = this.validateInput(input);
    const existing = await this.prisma.brainyWorkspaceAgent.findFirst({
      where: {
        id,
        workspace_id: workspaceId,
        deleted_at: null,
      },
    });

    if (!existing) {
      throw new AppError("Agente Brainy non trovato.", "BRAINY_AGENT_NOT_FOUND", 404);
    }

    const row = await this.prisma.$transaction(async (transaction) => {
      if (value.isDefault) {
        await transaction.brainyWorkspaceAgent.updateMany({
          where: {
            workspace_id: workspaceId,
            deleted_at: null,
            id: {
              not: id,
            },
          },
          data: {
            is_default: false,
            updated_by_user_id: userId,
          },
        });
      }

      await transaction.brainyWorkspaceAgent.update({
        where: { id },
        data: {
          brainyware_agent_id: value.brainywareAgentId,
          label: value.label,
          is_enabled: value.isEnabled,
          is_default: value.isDefault,
          is_workflow_enabled: value.isWorkflowEnabled,
          access_mode: value.accessMode,
          updated_by_user_id: userId,
        },
      });

      await this.syncRoleAssignments(transaction, workspaceId, id, value.roleIds);

      return transaction.brainyWorkspaceAgent.findUniqueOrThrow({
        where: { id },
        include: agentInclude,
      });
    });

    return this.toView(row);
  }

  public async remove(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<void> {
    const result = await this.prisma.brainyWorkspaceAgent.updateMany({
      where: {
        id,
        workspace_id: workspaceId,
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
        is_default: false,
        updated_by_user_id: userId,
      },
    });

    if (result.count === 0) {
      throw new AppError("Agente Brainy non trovato.", "BRAINY_AGENT_NOT_FOUND", 404);
    }
  }

  private validateInput(
    input: UpsertBrainyWorkspaceAgentInput,
  ): Required<UpsertBrainyWorkspaceAgentInput> {
    const brainywareAgentId = input.brainywareAgentId.trim();
    const label = input.label.trim();
    const roleIds = [...new Set(input.roleIds ?? [])];

    if (!brainywareAgentId || brainywareAgentId.length > 160) {
      throw new AppError(
        "L'ID agente Brainy non e' valido.",
        "BRAINY_AGENT_ID_INVALID",
        400,
      );
    }

    if (!label || label.length > 120) {
      throw new AppError(
        "Il nome dell'agente Brainy non e' valido.",
        "BRAINY_AGENT_LABEL_INVALID",
        400,
      );
    }

    if (roleIds.some((roleId) => !Number.isInteger(roleId) || roleId < 1)) {
      throw new AppError(
        "Le assegnazioni dell'agente Brainy non sono valide.",
        "BRAINY_AGENT_ASSIGNMENTS_INVALID",
        400,
      );
    }

    const isEnabled = input.isEnabled !== false;

    return {
      brainywareAgentId,
      label,
      isEnabled,
      isDefault: Boolean(input.isDefault) && isEnabled,
      isWorkflowEnabled: input.isWorkflowEnabled === true && isEnabled,
      accessMode: input.accessMode === "ASSIGNED" ? "ASSIGNED" : "ALL",
      roleIds,
    };
  }

  private async syncRoleAssignments(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    agentId: string,
    requestedRoleIds: number[],
  ): Promise<void> {
    const roles = await transaction.role.findMany({
      where: {
        id: {
          in: requestedRoleIds,
        },
        key: {
          in: ["admin", "operator"],
        },
        user_workspace_roles: {
          some: {
            workspace_id: workspaceId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (roles.length !== requestedRoleIds.length) {
      throw new AppError(
        "Il ruolo selezionato non e' disponibile nel workspace.",
        "BRAINY_AGENT_ASSIGNMENT_TARGET_INVALID",
        400,
      );
    }

    await transaction.brainyWorkspaceAgentAssignment.deleteMany({
      where: {
        workspace_agent_id: agentId,
      },
    });

    if (roles.length > 0) {
      await transaction.brainyWorkspaceAgentAssignment.createMany({
        data: roles.map((role) => ({
          workspace_agent_id: agentId,
          workspace_id: workspaceId,
          role_id: role.id,
        })),
      });
    }
  }

  private toView(row: AgentWithAssignments): BrainyWorkspaceAgentView {
    return {
      id: row.id,
      brainywareAgentId: row.brainyware_agent_id,
      label: row.label,
      isEnabled: row.is_enabled,
      isDefault: row.is_default,
      isWorkflowEnabled: row.is_workflow_enabled,
      accessMode: row.access_mode,
      assignments: row.assignments
        .filter((assignment) => assignment.role !== null)
        .map((assignment) => ({
          id: assignment.role!.id,
          label: assignment.role!.label || assignment.role!.key,
        })),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
