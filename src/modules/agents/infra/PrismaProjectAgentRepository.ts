import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { ProjectAgentEntity } from "../domain/ProjectAgentEntity.js";
import { ProjectAgentRepository } from "../repositories/ProjectAgentRepository.js";

interface ProjectAgentRow {
  id: string;
  workspace_id: string;
  project_id: string;
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
  project: {
    id: string;
    name: string;
  };
  module: {
    id: number;
    key: string;
    name: string;
  };
}

export class PrismaProjectAgentRepository implements ProjectAgentRepository {
  public async listProjectAgents(workspaceId: string): Promise<ProjectAgentEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.projectAgent.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
        project: {
          deleted_at: null,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
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
          project: {
            name: "asc",
          },
        },
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

    return rows.map((row) => this.toEntity(row as unknown as ProjectAgentRow));
  }

  public async findProjectAgentById(workspaceId: string, agentId: string): Promise<ProjectAgentEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.projectAgent.findFirst({
      where: {
        id: agentId,
        workspace_id: workspaceId,
        deleted_at: null,
        project: {
          deleted_at: null,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        module: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
    });

    return row ? this.toEntity(row as unknown as ProjectAgentRow) : null;
  }

  public async resolveActivePrompt(params: {
    workspaceId: string;
    moduleKey: string;
    agentKey: string;
    projectId?: string | null;
  }): Promise<string | null> {
    const prisma = PrismaClientManager.getClient();

    if (params.projectId) {
      const scoped = await prisma.projectAgent.findFirst({
        where: {
          workspace_id: params.workspaceId,
          project_id: params.projectId,
          key: params.agentKey,
          is_enabled: true,
          deleted_at: null,
          module: {
            key: params.moduleKey,
            is_active: true,
          },
          project: {
            deleted_at: null,
          },
        },
        select: {
          active_prompt: true,
        },
        orderBy: {
          updated_at: "desc",
        },
      });

      if (scoped?.active_prompt?.trim()) {
        return scoped.active_prompt.trim();
      }
    }

    const inherited = await prisma.projectAgent.findFirst({
      where: {
        workspace_id: params.workspaceId,
        key: params.agentKey,
        is_enabled: true,
        deleted_at: null,
        module: {
          key: params.moduleKey,
          is_active: true,
        },
        project: {
          deleted_at: null,
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

    return inherited?.active_prompt?.trim() ? inherited.active_prompt.trim() : null;
  }

  public async updateProjectAgentPrompt(params: {
    workspaceId: string;
    agentId: string;
    activePrompt: string;
    updatedByUserId: string;
  }): Promise<ProjectAgentEntity | null> {
    const prisma = PrismaClientManager.getClient();

    const existing = await prisma.projectAgent.findFirst({
      where: {
        id: params.agentId,
        workspace_id: params.workspaceId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    await prisma.projectAgent.update({
      where: { id: existing.id },
      data: {
        active_prompt: params.activePrompt,
        updated_by_user_id: params.updatedByUserId,
      },
    });

    return this.findProjectAgentById(params.workspaceId, existing.id);
  }

  public async resetProjectAgentPrompt(workspaceId: string, agentId: string, updatedByUserId: string): Promise<ProjectAgentEntity | null> {
    const prisma = PrismaClientManager.getClient();

    const existing = await prisma.projectAgent.findFirst({
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

    await prisma.projectAgent.update({
      where: { id: existing.id },
      data: {
        active_prompt: existing.original_prompt,
        updated_by_user_id: updatedByUserId,
      },
    });

    return this.findProjectAgentById(workspaceId, existing.id);
  }

  private toEntity(row: ProjectAgentRow): ProjectAgentEntity {
    return new ProjectAgentEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      projectName: row.project.name,
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
