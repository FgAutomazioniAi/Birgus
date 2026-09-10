import { Inject, Injectable } from "@nestjs/common";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaService } from "../../../nest/prisma/prisma.service.js";
import { BrainywareClient } from "./BrainywareClient.js";

export interface BrainyWorkspaceAgentView {
  id: string;
  brainywareAgentId: string;
  label: string;
  isEnabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UpsertBrainyWorkspaceAgentInput {
  brainywareAgentId: string;
  label: string;
  isEnabled?: boolean;
  isDefault?: boolean;
}

@Injectable()
export class BrainyWorkspaceAgentService {
  public constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(BrainywareClient)
    private readonly client: BrainywareClient,
  ) {}

  public async listAvailable() {
    return (await this.client.listAgents()).map((agent) => ({ id: agent.id, label: agent.name }));
  }

  public async list(workspaceId: string): Promise<BrainyWorkspaceAgentView[]> {
    const rows = await this.prisma.brainyWorkspaceAgent.findMany({
      where: { workspace_id: workspaceId, deleted_at: null },
      orderBy: [{ is_default: "desc" }, { label: "asc" }, { created_at: "asc" }],
    });
    return rows.map((row) => this.toView(row));
  }

  public async create(workspaceId: string, userId: string, input: UpsertBrainyWorkspaceAgentInput): Promise<BrainyWorkspaceAgentView> {
    const value = this.validateInput(input);
    const row = await this.prisma.$transaction(async (tx) => {
      if (value.isDefault) {
        await tx.brainyWorkspaceAgent.updateMany({
          where: { workspace_id: workspaceId, deleted_at: null },
          data: { is_default: false, updated_by_user_id: userId },
        });
      }
      return tx.brainyWorkspaceAgent.create({
        data: {
          workspace_id: workspaceId,
          brainyware_agent_id: value.brainywareAgentId,
          label: value.label,
          is_enabled: value.isEnabled,
          is_default: value.isDefault,
          created_by_user_id: userId,
          updated_by_user_id: userId,
        },
      });
    });
    return this.toView(row);
  }

  public async update(workspaceId: string, userId: string, id: string, input: UpsertBrainyWorkspaceAgentInput): Promise<BrainyWorkspaceAgentView> {
    const value = this.validateInput(input);
    const existing = await this.prisma.brainyWorkspaceAgent.findFirst({
      where: { id, workspace_id: workspaceId, deleted_at: null },
    });
    if (!existing) throw new AppError("Agente Brainy non trovato.", "BRAINY_AGENT_NOT_FOUND", 404);
    const row = await this.prisma.$transaction(async (tx) => {
      if (value.isDefault) {
        await tx.brainyWorkspaceAgent.updateMany({
          where: { workspace_id: workspaceId, deleted_at: null, id: { not: id } },
          data: { is_default: false, updated_by_user_id: userId },
        });
      }
      return tx.brainyWorkspaceAgent.update({
        where: { id },
        data: {
          brainyware_agent_id: value.brainywareAgentId,
          label: value.label,
          is_enabled: value.isEnabled,
          is_default: value.isDefault,
          updated_by_user_id: userId,
        },
      });
    });
    return this.toView(row);
  }

  public async archive(workspaceId: string, userId: string, id: string): Promise<void> {
    const result = await this.prisma.brainyWorkspaceAgent.updateMany({
      where: { id, workspace_id: workspaceId, deleted_at: null },
      data: { deleted_at: new Date(), is_default: false, updated_by_user_id: userId },
    });
    if (result.count === 0) throw new AppError("Agente Brainy non trovato.", "BRAINY_AGENT_NOT_FOUND", 404);
  }

  private validateInput(input: UpsertBrainyWorkspaceAgentInput): Required<UpsertBrainyWorkspaceAgentInput> {
    const brainywareAgentId = input.brainywareAgentId.trim();
    const label = input.label.trim();
    if (!brainywareAgentId || brainywareAgentId.length > 160) {
      throw new AppError("L'ID agente Brainy non e' valido.", "BRAINY_AGENT_ID_INVALID", 400);
    }
    if (!label || label.length > 120) {
      throw new AppError("Il nome dell'agente Brainy non e' valido.", "BRAINY_AGENT_LABEL_INVALID", 400);
    }
    const isEnabled = input.isEnabled !== false;
    const isDefault = Boolean(input.isDefault) && isEnabled;
    return { brainywareAgentId, label, isEnabled, isDefault };
  }

  private toView(row: {
    id: string;
    brainyware_agent_id: string;
    label: string;
    is_enabled: boolean;
    is_default: boolean;
    created_at: Date;
    updated_at: Date;
  }): BrainyWorkspaceAgentView {
    return {
      id: row.id,
      brainywareAgentId: row.brainyware_agent_id,
      label: row.label,
      isEnabled: row.is_enabled,
      isDefault: row.is_default,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
