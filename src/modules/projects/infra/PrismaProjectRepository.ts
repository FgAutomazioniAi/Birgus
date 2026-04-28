import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AppError } from "../../../core/errors/AppError.js";
import { ProjectEntity } from "../domain/ProjectEntity.js";
import { ProjectVersionEntity } from "../domain/ProjectVersionEntity.js";
import { ProjectRepository } from "../repositories/ProjectRepository.js";

export class PrismaProjectRepository implements ProjectRepository {
  public async listProjects(workspaceId: string): Promise<ProjectEntity[]> {
    const prisma = PrismaClientManager.getClient();

    const rows = await prisma.project.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
      },
      include: {
        status: {
          select: {
            key: true,
          },
        },
        project_clients: {
          where: {
            workspace_id: workspaceId,
            deleted_at: null,
          },
          select: {
            client_id: true,
          },
          take: 1,
        },
        project_versions: {
          where: {
            deleted_at: null,
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return rows.map((row) => new ProjectEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      statusKey: row.status.key,
      clientId: row.project_clients[0]?.client_id ?? null,
      createdAt: row.created_at,
      versionsCount: row.project_versions.length,
    }));
  }

  public async findProjectById(workspaceId: string, projectId: string): Promise<ProjectEntity | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.project.findFirst({
      where: {
        workspace_id: workspaceId,
        id: projectId,
        deleted_at: null,
      },
      include: {
        status: {
          select: {
            key: true,
          },
        },
        project_clients: {
          where: {
            workspace_id: workspaceId,
            deleted_at: null,
          },
          select: {
            client_id: true,
          },
          take: 1,
        },
        project_versions: {
          where: {
            deleted_at: null,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return new ProjectEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      statusKey: row.status.key,
      clientId: row.project_clients[0]?.client_id ?? null,
      createdAt: row.created_at,
      versionsCount: row.project_versions.length,
    });
  }

  public async updateProject(params: {
    workspaceId: string;
    projectId: string;
    projectName: string;
    statusKey: string;
  }): Promise<ProjectEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const existing = await this.findProjectById(params.workspaceId, params.projectId);
    if (!existing) {
      return null;
    }

    const status = await prisma.projectStatus.findFirst({
      where: {
        workspace_id: params.workspaceId,
        key: params.statusKey,
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (!status) {
      throw new AppError(`Project status '${params.statusKey}' not found.`, "PROJECT_STATUS_NOT_FOUND", 404);
    }

    const row = await prisma.project.update({
      where: {
        id: params.projectId,
      },
      data: {
        name: params.projectName,
        status_id: status.id,
      },
    });

    return new ProjectEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      statusKey: status.key,
      clientId: existing.clientId,
      createdAt: row.created_at,
      versionsCount: existing.versionsCount,
    });
  }

  public async setProjectPrimaryClient(workspaceId: string, projectId: string, clientId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.projectClient.updateMany({
      where: {
        workspace_id: workspaceId,
        project_id: projectId,
        deleted_at: null,
        client_id: {
          not: clientId,
        },
      },
      data: {
        deleted_at: new Date(),
      },
    });

    await prisma.projectClient.upsert({
      where: {
        workspace_id_project_id_client_id: {
          workspace_id: workspaceId,
          project_id: projectId,
          client_id: clientId,
        },
      },
      update: {
        deleted_at: null,
        updated_at: new Date(),
      },
      create: {
        workspace_id: workspaceId,
        project_id: projectId,
        client_id: clientId,
      },
    });
  }

  public async softDeleteProject(workspaceId: string, projectId: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const result = await prisma.$transaction(async (tx) => {
      const projectUpdate = await tx.project.updateMany({
        where: {
          workspace_id: workspaceId,
          id: projectId,
          deleted_at: null,
        },
        data: {
          deleted_at: new Date(),
        },
      });

      if (projectUpdate.count === 0) {
        return 0;
      }

      await tx.projectVersion.updateMany({
        where: {
          workspace_id: workspaceId,
          project_id: projectId,
          deleted_at: null,
        },
        data: {
          deleted_at: new Date(),
          is_default: false,
        },
      });

      await tx.projectClient.updateMany({
        where: {
          workspace_id: workspaceId,
          project_id: projectId,
          deleted_at: null,
        },
        data: {
          deleted_at: new Date(),
        },
      });

      return projectUpdate.count;
    });

    return result > 0;
  }

  public async createProject(params: {
    workspaceId: string;
    projectName: string;
    ownerUserId: string;
    statusKey: string;
  }): Promise<ProjectEntity> {
    const prisma = PrismaClientManager.getClient();

    const status = await prisma.projectStatus.findFirst({
      where: {
        workspace_id: params.workspaceId,
        key: params.statusKey,
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (!status) {
      throw new AppError(`Project status '${params.statusKey}' not found.`, "PROJECT_STATUS_NOT_FOUND", 404);
    }

    const row = await prisma.project.create({
      data: {
        workspace_id: params.workspaceId,
        name: params.projectName,
        owner_user_id: params.ownerUserId,
        status_id: status.id,
      },
      include: {
        status: {
          select: {
            key: true,
          },
        },
      },
    });

    return new ProjectEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      statusKey: row.status.key,
      createdAt: row.created_at,
      versionsCount: 0,
    });
  }

  public async linkProjectClient(workspaceId: string, projectId: string, clientId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.projectClient.upsert({
      where: {
        workspace_id_project_id_client_id: {
          workspace_id: workspaceId,
          project_id: projectId,
          client_id: clientId,
        },
      },
      update: {
        deleted_at: null,
      },
      create: {
        workspace_id: workspaceId,
        project_id: projectId,
        client_id: clientId,
      },
    });
  }

  public async listVersions(workspaceId: string, projectId: string): Promise<ProjectVersionEntity[]> {
    const prisma = PrismaClientManager.getClient();

    const rows = await prisma.projectVersion.findMany({
      where: {
        workspace_id: workspaceId,
        project_id: projectId,
        deleted_at: null,
      },
      include: {
        status: {
          select: {
            key: true,
          },
        },
        client: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: [
        { created_at: "asc" },
        { id: "asc" },
      ],
    });

    return rows.map((row) => new ProjectVersionEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      versionLabel: row.version_label,
      description: row.description,
      clientId: row.client_id,
      clientName: row.client ? [row.client.first_name, row.client.last_name ?? ""].join(" ").trim() : null,
      statusKey: row.status?.key ?? null,
      isDefault: row.is_default,
      createdAt: row.created_at,
    }));
  }

  public async findVersionByLabel(
    workspaceId: string,
    projectId: string,
    versionLabel: string,
  ): Promise<ProjectVersionEntity | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.projectVersion.findFirst({
      where: {
        workspace_id: workspaceId,
        project_id: projectId,
        version_label: versionLabel,
        deleted_at: null,
      },
      include: {
        status: {
          select: {
            key: true,
          },
        },
        client: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return new ProjectVersionEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      versionLabel: row.version_label,
      description: row.description,
      clientId: row.client_id,
      clientName: row.client ? [row.client.first_name, row.client.last_name ?? ""].join(" ").trim() : null,
      statusKey: row.status?.key ?? null,
      isDefault: row.is_default,
      createdAt: row.created_at,
    });
  }

  public async countActiveVersions(workspaceId: string, projectId: string): Promise<number> {
    const prisma = PrismaClientManager.getClient();

    return prisma.projectVersion.count({
      where: {
        workspace_id: workspaceId,
        project_id: projectId,
        deleted_at: null,
      },
    });
  }

  public async createVersion(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    description: string;
    statusKey: string;
    clientId: string | null;
    isDefault: boolean;
  }): Promise<ProjectVersionEntity> {
    const prisma = PrismaClientManager.getClient();

    const status = await prisma.projectStatus.findFirst({
      where: {
        workspace_id: params.workspaceId,
        key: params.statusKey,
      },
      select: {
        id: true,
      },
    });

    if (!status) {
      throw new AppError(`Project status '${params.statusKey}' not found.`, "PROJECT_STATUS_NOT_FOUND", 404);
    }

    const row = await prisma.projectVersion.create({
      data: {
        workspace_id: params.workspaceId,
        project_id: params.projectId,
        version_label: params.versionLabel,
        description: params.description,
        client_id: params.clientId,
        status_id: status.id,
        is_default: params.isDefault,
      },
      include: {
        status: {
          select: {
            key: true,
          },
        },
        client: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    return new ProjectVersionEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      versionLabel: row.version_label,
      description: row.description,
      clientId: row.client_id,
      clientName: row.client ? [row.client.first_name, row.client.last_name ?? ""].join(" ").trim() : null,
      statusKey: row.status?.key ?? null,
      isDefault: row.is_default,
      createdAt: row.created_at,
    });
  }

  public async clearDefaultVersionFlags(workspaceId: string, projectId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.projectVersion.updateMany({
      where: {
        workspace_id: workspaceId,
        project_id: projectId,
        deleted_at: null,
      },
      data: {
        is_default: false,
      },
    });
  }

  public async setDefaultVersion(versionId: number): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.projectVersion.update({
      where: {
        id: versionId,
      },
      data: {
        is_default: true,
      },
    });
  }

  public async softDeleteVersion(versionId: number): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.projectVersion.update({
      where: {
        id: versionId,
      },
      data: {
        deleted_at: new Date(),
        is_default: false,
      },
    });
  }

  public async findMostRecentActiveVersion(workspaceId: string, projectId: string): Promise<ProjectVersionEntity | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.projectVersion.findFirst({
      where: {
        workspace_id: workspaceId,
        project_id: projectId,
        deleted_at: null,
      },
      include: {
        status: {
          select: {
            key: true,
          },
        },
        client: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: [
        { created_at: "desc" },
        { id: "desc" },
      ],
    });

    if (!row) {
      return null;
    }

    return new ProjectVersionEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      versionLabel: row.version_label,
      description: row.description,
      clientId: row.client_id,
      clientName: row.client ? [row.client.first_name, row.client.last_name ?? ""].join(" ").trim() : null,
      statusKey: row.status?.key ?? null,
      isDefault: row.is_default,
      createdAt: row.created_at,
    });
  }
}
