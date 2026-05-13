import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { CompanyEntity } from "../domain/CompanyEntity.js";
import { CompanyRepository } from "../repositories/CompanyRepository.js";

export class PrismaCompanyRepository implements CompanyRepository {
  public async list(workspaceId: string): Promise<CompanyEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.company.findMany({
      where: { workspace_id: workspaceId, deleted_at: null },
      orderBy: [{ name: "asc" }, { created_at: "asc" }],
    });

    return rows.map((row) => this.mapRow(row));
  }

  public async findById(workspaceId: string, companyId: number): Promise<CompanyEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.company.findFirst({
      where: { workspace_id: workspaceId, id: companyId, deleted_at: null },
    });

    return row ? this.mapRow(row) : null;
  }

  public async create(params: {
    workspaceId: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
  }): Promise<CompanyEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.company.create({
      data: {
        workspace_id: params.workspaceId,
        name: params.name,
        address: params.address || null,
        postal_code: params.postalCode || null,
        city: params.city || null,
      },
    });

    return this.mapRow(row);
  }

  public async update(params: {
    workspaceId: string;
    companyId: number;
    name: string;
    address: string;
    postalCode: string;
    city: string;
  }): Promise<CompanyEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.company.findFirst({
      where: { workspace_id: params.workspaceId, id: params.companyId, deleted_at: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.company.update({
      where: { id: params.companyId },
      data: {
        name: params.name,
        address: params.address || null,
        postal_code: params.postalCode || null,
        city: params.city || null,
      },
    });

    return this.mapRow(row);
  }

  public async softDelete(workspaceId: string, companyId: number): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const result = await prisma.company.updateMany({
      where: { workspace_id: workspaceId, id: companyId, deleted_at: null },
      data: { deleted_at: new Date() },
    });

    return result.count > 0;
  }

  private mapRow(row: {
    id: number;
    workspace_id: string;
    name: string;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    created_at: Date;
  }): CompanyEntity {
    return new CompanyEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      address: row.address,
      postalCode: row.postal_code,
      city: row.city,
      createdAt: row.created_at,
    });
  }
}
