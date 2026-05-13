import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { ProjectRevisionEntity } from "../domain/ProjectRevisionEntity.js";
import { ProjectRevisionRepository } from "../repositories/ProjectRevisionRepository.js";

export class PrismaProjectRevisionRepository implements ProjectRevisionRepository {
  public async list(workspaceId: string): Promise<ProjectRevisionEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.projectRevision.findMany({
      where: { workspace_id: workspaceId },
      orderBy: [{ code: "asc" }, { created_at: "asc" }],
    });

    return rows.map((row) => this.mapRow(row));
  }

  public async findById(workspaceId: string, revisionId: number): Promise<ProjectRevisionEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.projectRevision.findFirst({
      where: { workspace_id: workspaceId, id: revisionId },
    });

    return row ? this.mapRow(row) : null;
  }

  public async create(params: { workspaceId: string; code: string }): Promise<ProjectRevisionEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.projectRevision.create({
      data: { workspace_id: params.workspaceId, code: params.code },
    });

    return this.mapRow(row);
  }

  public async update(params: { workspaceId: string; revisionId: number; code: string }): Promise<ProjectRevisionEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.projectRevision.findFirst({
      where: { workspace_id: params.workspaceId, id: params.revisionId },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.projectRevision.update({
      where: { id: params.revisionId },
      data: { code: params.code },
    });

    return this.mapRow(row);
  }

  public async delete(workspaceId: string, revisionId: number): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const result = await prisma.projectRevision.deleteMany({
      where: { workspace_id: workspaceId, id: revisionId },
    });

    return result.count > 0;
  }

  private mapRow(row: { id: number; workspace_id: string; code: string; created_at: Date }): ProjectRevisionEntity {
    return new ProjectRevisionEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      code: row.code,
      createdAt: row.created_at,
    });
  }
}
