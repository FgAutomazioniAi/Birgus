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
        author: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            display_name: true,
          },
        },
        revision: {
          select: {
            id: true,
            code: true,
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
      authorId: row.author?.id ?? null,
      authorName: row.author?.display_name ?? [row.author?.first_name ?? "", row.author?.last_name ?? ""].join(" ").trim(),
      revisionId: row.revision?.id ?? null,
      revisionCode: row.revision?.code ?? "",
      publisherName: row.publisher_name ?? "",
      publicationDate: row.publication_date,
      authorDate: row.author_date,
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
        author: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            display_name: true,
          },
        },
        revision: {
          select: {
            id: true,
            code: true,
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
      authorId: row.author?.id ?? null,
      authorName: row.author?.display_name ?? [row.author?.first_name ?? "", row.author?.last_name ?? ""].join(" ").trim(),
      revisionId: row.revision?.id ?? null,
      revisionCode: row.revision?.code ?? "",
      publisherName: row.publisher_name ?? "",
      publicationDate: row.publication_date,
      authorDate: row.author_date,
      createdAt: row.created_at,
      versionsCount: row.project_versions.length,
    });
  }

  public async updateProject(params: {
    workspaceId: string;
    projectId: string;
    projectName: string;
    statusKey: string;
    authorId: number | null;
    revisionId: number | null;
    publisherName: string;
    publicationDate: Date | null;
    authorDate: Date | null;
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

    if (params.authorId !== null) {
      const author = await prisma.projectAuthor.findFirst({
        where: {
          workspace_id: params.workspaceId,
          id: params.authorId,
          deleted_at: null,
        },
        select: { id: true },
      });

      if (!author) {
        throw new AppError("Project author not found.", "PROJECT_AUTHOR_NOT_FOUND", 404);
      }
    }

    if (params.revisionId !== null) {
      const revision = await prisma.projectRevision.findFirst({
        where: {
          workspace_id: params.workspaceId,
          id: params.revisionId,
        },
        select: { id: true },
      });

      if (!revision) {
        throw new AppError("Project revision not found.", "PROJECT_REVISION_NOT_FOUND", 404);
      }
    }

    const row = await prisma.project.update({
      where: {
        id: params.projectId,
      },
      data: {
        name: params.projectName,
        status_id: status.id,
        author_id: params.authorId,
        revision_id: params.revisionId,
        publisher_name: params.publisherName || null,
        publication_date: params.publicationDate,
        author_date: params.authorDate,
      },
    });

    return new ProjectEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      statusKey: status.key,
      clientId: existing.clientId,
      authorId: params.authorId,
      authorName: existing.authorId === params.authorId ? existing.authorName : "",
      revisionId: params.revisionId,
      revisionCode: existing.revisionId === params.revisionId ? existing.revisionCode : "",
      publisherName: row.publisher_name ?? "",
      publicationDate: row.publication_date,
      authorDate: row.author_date,
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
    authorId: number | null;
    revisionId: number | null;
    publisherName: string;
    publicationDate: Date | null;
    authorDate: Date | null;
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

    if (params.authorId !== null) {
      const author = await prisma.projectAuthor.findFirst({
        where: {
          workspace_id: params.workspaceId,
          id: params.authorId,
          deleted_at: null,
        },
        select: { id: true },
      });

      if (!author) {
        throw new AppError("Project author not found.", "PROJECT_AUTHOR_NOT_FOUND", 404);
      }
    }

    if (params.revisionId !== null) {
      const revision = await prisma.projectRevision.findFirst({
        where: {
          workspace_id: params.workspaceId,
          id: params.revisionId,
        },
        select: { id: true },
      });

      if (!revision) {
        throw new AppError("Project revision not found.", "PROJECT_REVISION_NOT_FOUND", 404);
      }
    }

    const row = await prisma.project.create({
      data: {
        workspace_id: params.workspaceId,
        name: params.projectName,
        owner_user_id: params.ownerUserId,
        status_id: status.id,
        author_id: params.authorId,
        revision_id: params.revisionId,
        publisher_name: params.publisherName || null,
        publication_date: params.publicationDate,
        author_date: params.authorDate,
      },
      include: {
        status: {
          select: {
            key: true,
          },
        },
        author: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            display_name: true,
          },
        },
        revision: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    });

    return new ProjectEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      statusKey: row.status.key,
      authorId: row.author?.id ?? null,
      authorName: row.author?.display_name ?? [row.author?.first_name ?? "", row.author?.last_name ?? ""].join(" ").trim(),
      revisionId: row.revision?.id ?? null,
      revisionCode: row.revision?.code ?? "",
      publisherName: row.publisher_name ?? "",
      publicationDate: row.publication_date,
      authorDate: row.author_date,
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
        shipment: {
          select: {
            id: true,
            code: true,
            deleted_at: true,
            status: {
              select: {
                key: true,
              },
            },
          },
        },
      },
      orderBy: [
        { created_at: "asc" },
        { id: "asc" },
      ],
    });

    return rows.map((row) => this.mapProjectVersion(row));
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
        shipment: {
          select: {
            id: true,
            code: true,
            deleted_at: true,
            status: {
              select: {
                key: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return this.mapProjectVersion(row);
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
        shipment: {
          select: {
            id: true,
            code: true,
            deleted_at: true,
            status: {
              select: {
                key: true,
              },
            },
          },
        },
      },
    });

    return this.mapProjectVersion(row);
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
        shipment: {
          select: {
            id: true,
            code: true,
            deleted_at: true,
            status: {
              select: {
                key: true,
              },
            },
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

    return this.mapProjectVersion(row);
  }

  private mapProjectVersion(row: {
      id: number;
      workspace_id: string;
      project_id: string;
      version_label: string;
      description: string;
      client_id: string | null;
      is_default: boolean;
      created_at: Date;
      client: { first_name: string; last_name: string | null } | null;
      status: { key: string } | null;
      shipment:
        | {
            id: string;
            code: string;
            deleted_at: Date | null;
            status: {
              key: string;
            };
          }
        | null;
    }): ProjectVersionEntity {
    const activeShipment = row.shipment && row.shipment.deleted_at === null ? row.shipment : null;

    return new ProjectVersionEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      versionLabel: row.version_label,
      description: row.description,
      clientId: row.client_id,
      clientName: row.client ? [row.client.first_name, row.client.last_name ?? ""].join(" ").trim() : null,
      statusKey: row.status?.key ?? null,
      shipmentId: activeShipment?.id ?? null,
      shipmentCode: activeShipment?.code ?? null,
      shipmentStatusKey: activeShipment?.status.key ?? null,
      isDefault: row.is_default,
      createdAt: row.created_at,
    });
  }
}
