import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { ProjectAuthorEntity } from "../../projects/domain/ProjectAuthorEntity.js";
import { ProjectAuthorRepository } from "../repositories/ProjectAuthorRepository.js";

export class PrismaProjectAuthorRepository implements ProjectAuthorRepository {
  public async list(workspaceId: string): Promise<ProjectAuthorEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.projectAuthor.findMany({
      where: { workspace_id: workspaceId, deleted_at: null },
      orderBy: [{ display_name: "asc" }, { first_name: "asc" }, { last_name: "asc" }],
    });

    return rows.map((row) => this.mapRow(row));
  }

  public async findById(workspaceId: string, authorId: number): Promise<ProjectAuthorEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.projectAuthor.findFirst({
      where: { workspace_id: workspaceId, id: authorId, deleted_at: null },
    });

    return row ? this.mapRow(row) : null;
  }

  public async create(params: {
    workspaceId: string;
    firstName: string;
    lastName: string;
    displayName: string;
    notes: string;
  }): Promise<ProjectAuthorEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.projectAuthor.create({
      data: {
        workspace_id: params.workspaceId,
        first_name: params.firstName,
        last_name: params.lastName || null,
        display_name: params.displayName || null,
        notes: params.notes || null,
      },
    });

    return this.mapRow(row);
  }

  public async update(params: {
    workspaceId: string;
    authorId: number;
    firstName: string;
    lastName: string;
    displayName: string;
    notes: string;
  }): Promise<ProjectAuthorEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.projectAuthor.findFirst({
      where: { workspace_id: params.workspaceId, id: params.authorId, deleted_at: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.projectAuthor.update({
      where: { id: params.authorId },
      data: {
        first_name: params.firstName,
        last_name: params.lastName || null,
        display_name: params.displayName || null,
        notes: params.notes || null,
      },
    });

    return this.mapRow(row);
  }

  public async softDelete(workspaceId: string, authorId: number): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const result = await prisma.projectAuthor.updateMany({
      where: { workspace_id: workspaceId, id: authorId, deleted_at: null },
      data: { deleted_at: new Date() },
    });

    return result.count > 0;
  }

  private mapRow(row: {
    id: number;
    workspace_id: string;
    first_name: string;
    last_name: string | null;
    display_name: string | null;
    notes: string | null;
  }): ProjectAuthorEntity {
    return new ProjectAuthorEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name ?? [row.first_name, row.last_name ?? ""].join(" ").trim(),
      notes: row.notes,
    });
  }
}
