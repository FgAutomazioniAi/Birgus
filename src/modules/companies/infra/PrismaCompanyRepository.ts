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
    isHeadquarters: boolean;
    legalName: string;
    vatNumber: string;
    taxCode: string;
    email: string;
    phone: string;
    website: string;
    industry: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
    latitude: string;
    longitude: string;
    notes: string;
  }): Promise<CompanyEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.$transaction(async (tx) => {
      if (params.isHeadquarters) {
        await tx.company.updateMany({
          where: { workspace_id: params.workspaceId, name: { equals: params.name, mode: "insensitive" }, deleted_at: null },
          data: { is_headquarters: false },
        });
      }

      return tx.company.create({
        data: {
          workspace_id: params.workspaceId,
          name: params.name,
          is_headquarters: params.isHeadquarters,
          legal_name: params.legalName || null,
          vat_number: params.vatNumber || null,
          tax_code: params.taxCode || null,
          email: params.email || null,
          phone: params.phone || null,
          website: params.website || null,
          industry: params.industry || null,
          address: params.address || null,
          postal_code: params.postalCode || null,
          city: params.city || null,
          province: params.province || null,
          country: params.country || null,
          latitude: this.parseCoordinate(params.latitude),
          longitude: this.parseCoordinate(params.longitude),
          notes: params.notes || null,
        },
      });
    });

    return this.mapRow(row);
  }

  public async update(params: {
    workspaceId: string;
    companyId: number;
    name: string;
    isHeadquarters: boolean;
    legalName: string;
    vatNumber: string;
    taxCode: string;
    email: string;
    phone: string;
    website: string;
    industry: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
    latitude: string;
    longitude: string;
    notes: string;
  }): Promise<CompanyEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.company.findFirst({
      where: { workspace_id: params.workspaceId, id: params.companyId, deleted_at: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const row = await prisma.$transaction(async (tx) => {
      if (params.isHeadquarters) {
        await tx.company.updateMany({
          where: {
            workspace_id: params.workspaceId,
            id: { not: params.companyId },
            name: { equals: params.name, mode: "insensitive" },
            deleted_at: null,
          },
          data: { is_headquarters: false },
        });
      }

      return tx.company.update({
        where: { id: params.companyId },
        data: {
          name: params.name,
          is_headquarters: params.isHeadquarters,
          legal_name: params.legalName || null,
          vat_number: params.vatNumber || null,
          tax_code: params.taxCode || null,
          email: params.email || null,
          phone: params.phone || null,
          website: params.website || null,
          industry: params.industry || null,
          address: params.address || null,
          postal_code: params.postalCode || null,
          city: params.city || null,
          province: params.province || null,
          country: params.country || null,
          latitude: this.parseCoordinate(params.latitude),
          longitude: this.parseCoordinate(params.longitude),
          notes: params.notes || null,
        },
      });
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
    is_headquarters: boolean;
    legal_name: string | null;
    vat_number: string | null;
    tax_code: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    industry: string | null;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    latitude: { toString(): string } | null;
    longitude: { toString(): string } | null;
    notes: string | null;
    created_at: Date;
  }): CompanyEntity {
    return new CompanyEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      isHeadquarters: row.is_headquarters,
      legalName: row.legal_name,
      vatNumber: row.vat_number,
      taxCode: row.tax_code,
      email: row.email,
      phone: row.phone,
      website: row.website,
      industry: row.industry,
      address: row.address,
      postalCode: row.postal_code,
      city: row.city,
      province: row.province,
      country: row.country,
      latitude: row.latitude?.toString() ?? null,
      longitude: row.longitude?.toString() ?? null,
      notes: row.notes,
      createdAt: row.created_at,
    });
  }

  private parseCoordinate(value: string): string | null {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? normalized : null;
  }
}
