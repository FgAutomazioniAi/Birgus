import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { ModuleAgentEntity } from "../domain/ModuleAgentEntity.js";
import { ModuleAgentRepository } from "../repositories/ModuleAgentRepository.js";

interface ModuleAgentRow {
  id: string;
  workspace_id: string;
  module_id: number;
  key: string;
  name: string;
  label: string;
  original_prompt: string;
  active_prompt: string;
  is_enabled: boolean;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  module: {
    id: number;
    key: string;
    name: string;
  };
}

export class PrismaModuleAgentRepository implements ModuleAgentRepository {
  public async listModuleAgents(workspaceId: string): Promise<ModuleAgentEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.moduleAgent.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
        module: {
          is_active: true,
        },
      },
      include: {
        module: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          module: {
            key: "asc",
          },
        },
        {
          label: "asc",
        },
      ],
    });

    return rows.map((row) => this.toEntity(row as unknown as ModuleAgentRow));
  }

  public async findModuleAgentById(workspaceId: string, agentId: string): Promise<ModuleAgentEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.moduleAgent.findFirst({
      where: {
        id: agentId,
        workspace_id: workspaceId,
        deleted_at: null,
        module: {
          is_active: true,
        },
      },
      include: {
        module: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    return row ? this.toEntity(row as unknown as ModuleAgentRow) : null;
  }

  public async resolveActivePrompt(params: {
    workspaceId: string;
    moduleKey: string;
    agentKey: string;
  }): Promise<string | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.moduleAgent.findFirst({
      where: {
        workspace_id: params.workspaceId,
        key: params.agentKey,
        is_enabled: true,
        deleted_at: null,
        module: {
          key: params.moduleKey,
          is_active: true,
        },
      },
      select: {
        active_prompt: true,
      },
      orderBy: [
        {
          updated_at: "desc",
        },
        {
          created_at: "desc",
        },
      ],
    });

    return row?.active_prompt?.trim() ? row.active_prompt.trim() : null;
  }

  public async updateModuleAgentPrompt(params: {
    workspaceId: string;
    agentId: string;
    activePrompt: string;
    updatedByUserId: string;
  }): Promise<ModuleAgentEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.moduleAgent.findFirst({
      where: {
        id: params.agentId,
        workspace_id: params.workspaceId,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return null;
    }

    await prisma.moduleAgent.update({
      where: {
        id: existing.id,
      },
      data: {
        active_prompt: params.activePrompt,
        updated_by_user_id: params.updatedByUserId,
      },
    });

    return this.findModuleAgentById(params.workspaceId, existing.id);
  }

  public async resetModuleAgentPrompt(workspaceId: string, agentId: string, updatedByUserId: string): Promise<ModuleAgentEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.moduleAgent.findFirst({
      where: {
        id: agentId,
        workspace_id: workspaceId,
        deleted_at: null,
      },
      select: {
        id: true,
        original_prompt: true,
      },
    });

    if (!existing) {
      return null;
    }

    await prisma.moduleAgent.update({
      where: {
        id: existing.id,
      },
      data: {
        active_prompt: existing.original_prompt,
        updated_by_user_id: updatedByUserId,
      },
    });

    return this.findModuleAgentById(workspaceId, existing.id);
  }

  private toEntity(row: ModuleAgentRow): ModuleAgentEntity {
    return new ModuleAgentEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      moduleId: row.module_id,
      moduleKey: row.module.key,
      moduleName: row.module.name,
      key: row.key,
      name: row.name,
      label: row.label,
      originalPrompt: row.original_prompt,
      activePrompt: row.active_prompt,
      isEnabled: row.is_enabled,
      createdByUserId: row.created_by_user_id,
      updatedByUserId: row.updated_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
