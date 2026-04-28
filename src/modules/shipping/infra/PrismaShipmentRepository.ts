import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { ShipmentEntity } from "../domain/ShipmentEntity.js";
import { ShipmentRepository } from "../repositories/ShipmentRepository.js";

export class PrismaShipmentRepository implements ShipmentRepository {
  public async listShipments(workspaceId: string): Promise<ShipmentEntity[]> {
    const prisma = PrismaClientManager.getClient();

    const rows = await prisma.shipment.findMany({
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
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return rows.map((row) => new ShipmentEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      code: row.code,
      clientId: row.client_id,
      statusKey: row.status.key,
      createdAt: row.created_at,
    }));
  }

  public async createShipment(params: {
    workspaceId: string;
    code: string;
    clientId: string | null;
    statusKey: string;
    notes: string | null;
    createdByUserId: string | null;
  }): Promise<ShipmentEntity> {
    const prisma = PrismaClientManager.getClient();

    const status = await prisma.shipmentStatus.findFirst({
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
      throw new AppError(`Shipment status '${params.statusKey}' not found.`, "SHIPMENT_STATUS_NOT_FOUND", 404);
    }

    const row = await prisma.shipment.create({
      data: {
        workspace_id: params.workspaceId,
        code: params.code,
        client_id: params.clientId,
        status_id: status.id,
        notes: params.notes,
        created_by_user_id: params.createdByUserId,
      },
      include: {
        status: {
          select: {
            key: true,
          },
        },
      },
    });

    return new ShipmentEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      code: row.code,
      clientId: row.client_id,
      statusKey: row.status.key,
      createdAt: row.created_at,
    });
  }
}
