import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { ClientEntity } from "../domain/ClientEntity.js";
import { ClientRepository } from "../repositories/ClientRepository.js";

export class PrismaClientRepository implements ClientRepository {
  public async list(workspaceId: string): Promise<ClientEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.client.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { first_name: "asc" },
        { last_name: "asc" },
        { created_at: "asc" },
      ],
    });

    return rows.map((row) => this.mapRowToEntity(row));
  }

  public async findById(workspaceId: string, clientId: string): Promise<ClientEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.client.findFirst({
      where: {
        workspace_id: workspaceId,
        id: clientId,
        deleted_at: null,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return row ? this.mapRowToEntity(row) : null;
  }

  public async create(params: {
    workspaceId: string;
    name: string;
    companyId: number | null;
    role: string;
    department: string;
    email: string;
    phone: string;
    mobile: string;
    address: string;
    city: string;
    province: string;
    country: string;
    notes: string;
  }): Promise<ClientEntity> {
    const prisma = PrismaClientManager.getClient();
    const [firstName, ...tail] = params.name.trim().split(/\s+/);
    const lastName = tail.join(" ").trim() || null;

    if (params.companyId !== null) {
      const company = await prisma.company.findFirst({
        where: {
          workspace_id: params.workspaceId,
          id: params.companyId,
          deleted_at: null,
        },
        select: { id: true },
      });

      if (!company) {
        throw new Error("COMPANY_NOT_FOUND");
      }
    }

    const row = await prisma.client.create({
      data: {
        workspace_id: params.workspaceId,
        company_id: params.companyId,
        first_name: firstName || params.name.trim(),
        last_name: lastName,
        role: params.role || null,
        department: params.department || null,
        email: params.email || null,
        phone: params.phone || null,
        mobile: params.mobile || null,
        address: params.address || null,
        city: params.city || null,
        province: params.province || null,
        country: params.country || null,
        notes: params.notes || null,
      },
    });

    return this.mapRowToEntity(row);
  }

  public async update(params: {
    workspaceId: string;
    clientId: string;
    name: string;
    companyId: number | null;
    role: string;
    department: string;
    email: string;
    phone: string;
    mobile: string;
    address: string;
    city: string;
    province: string;
    country: string;
    notes: string;
  }): Promise<ClientEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.client.findFirst({
      where: {
        workspace_id: params.workspaceId,
        id: params.clientId,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return null;
    }

    const [firstName, ...tail] = params.name.trim().split(/\s+/);
    const lastName = tail.join(" ").trim() || null;

    if (params.companyId !== null) {
      const company = await prisma.company.findFirst({
        where: {
          workspace_id: params.workspaceId,
          id: params.companyId,
          deleted_at: null,
        },
        select: { id: true },
      });

      if (!company) {
        throw new Error("COMPANY_NOT_FOUND");
      }
    }

    const row = await prisma.client.update({
      where: {
        id: params.clientId,
      },
      data: {
        company_id: params.companyId,
        first_name: firstName || params.name.trim(),
        last_name: lastName,
        role: params.role || null,
        department: params.department || null,
        email: params.email || null,
        phone: params.phone || null,
        mobile: params.mobile || null,
        address: params.address || null,
        city: params.city || null,
        province: params.province || null,
        country: params.country || null,
        notes: params.notes || null,
      },
    });

    return this.mapRowToEntity(row);
  }

  public async softDelete(workspaceId: string, clientId: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const result = await prisma.client.updateMany({
      where: {
        workspace_id: workspaceId,
        id: clientId,
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
      },
    });

    return result.count > 0;
  }

  public async hardDelete(workspaceId: string, clientId: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    return prisma.$transaction(async (tx) => {
      const existing = await tx.client.findFirst({
        where: { workspace_id: workspaceId, id: clientId },
        select: { id: true },
      });
      if (!existing) return false;

      await tx.projectClient.deleteMany({ where: { workspace_id: workspaceId, client_id: clientId } });
      await tx.client.delete({ where: { id: clientId } });
      return true;
    });
  }

  private mapRowToEntity(row: {
    id: string;
    workspace_id: string;
    company_id: number | null;
    first_name: string;
    last_name: string | null;
    role: string | null;
    department: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    notes: string | null;
    created_at: Date;
    company?: {
      id: number;
      name: string;
    } | null;
  }): ClientEntity {
    const name = [row.first_name, row.last_name ?? ""].join(" ").trim();

    return new ClientEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      name,
      companyId: row.company_id,
      companyName: row.company?.name ?? "",
      role: row.role,
      department: row.department,
      email: row.email ?? "",
      phone: row.phone ?? "",
      mobile: row.mobile,
      address: row.address,
      city: row.city,
      province: row.province,
      country: row.country,
      notes: row.notes ?? "",
      createdAt: row.created_at,
    });
  }
}
