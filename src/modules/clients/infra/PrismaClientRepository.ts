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
    email: string;
    phone: string;
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
        email: params.email || null,
        phone: params.phone || null,
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
    email: string;
    phone: string;
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
        email: params.email || null,
        phone: params.phone || null,
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

  private mapRowToEntity(row: {
    id: string;
    workspace_id: string;
    company_id: number | null;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
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
      email: row.email ?? "",
      phone: row.phone ?? "",
      notes: row.notes ?? "",
      createdAt: row.created_at,
    });
  }
}
