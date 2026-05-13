import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { ShipmentEntity } from "../domain/ShipmentEntity.js";
import { ShipmentProjectVersionSummary, ShipmentRepository } from "../repositories/ShipmentRepository.js";

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
        client: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        project_version: {
          select: {
            id: true,
            version_label: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        specification: {
          select: {
            updated_at: true,
          },
        },
        shipment_items: true,
        shipment_events: {
          include: {
            status: {
              select: { key: true },
            },
          },
          orderBy: { occurred_at: "desc" },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return rows.map((row) => this.mapShipment(row));
  }

  public async findShipmentById(workspaceId: string, shipmentId: string): Promise<ShipmentEntity | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.shipment.findFirst({
      where: {
        workspace_id: workspaceId,
        id: shipmentId,
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
        project_version: {
          select: {
            id: true,
            version_label: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        specification: {
          select: {
            input_payload: true,
            calculation_payload: true,
            updated_at: true,
          },
        },
        shipment_items: true,
        shipment_events: {
          include: {
            status: {
              select: { key: true },
            },
          },
          orderBy: { occurred_at: "desc" },
        },
      },
    });

    return row ? this.mapShipment(row) : null;
  }

  public async findByProjectVersionId(workspaceId: string, projectVersionId: number): Promise<ShipmentEntity | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.shipment.findFirst({
      where: {
        workspace_id: workspaceId,
        project_version_id: projectVersionId,
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
        project_version: {
          select: {
            id: true,
            version_label: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        specification: {
          select: {
            updated_at: true,
          },
        },
        shipment_items: true,
        shipment_events: {
          include: {
            status: {
              select: { key: true },
            },
          },
          orderBy: { occurred_at: "desc" },
        },
      },
    });

    return row ? this.mapShipment(row) : null;
  }

  public async findProjectVersionSummary(
    workspaceId: string,
    projectVersionId: number,
  ): Promise<ShipmentProjectVersionSummary | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.projectVersion.findFirst({
      where: {
        workspace_id: workspaceId,
        id: projectVersionId,
        deleted_at: null,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
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

    return {
      workspaceId: row.workspace_id,
      projectId: row.project.id,
      projectName: row.project.name,
      projectVersionId: row.id,
      projectVersionLabel: row.version_label,
      clientId: row.client_id,
      clientName: row.client ? [row.client.first_name, row.client.last_name ?? ""].join(" ").trim() : null,
    };
  }

  public async createShipment(params: {
    workspaceId: string;
    projectVersionId: number;
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
        project_version_id: params.projectVersionId,
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
        client: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        project_version: {
          select: {
            id: true,
            version_label: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        specification: {
          select: {
            updated_at: true,
          },
        },
        shipment_items: true,
        shipment_events: {
          include: {
            status: {
              select: { key: true },
            },
          },
          orderBy: { occurred_at: "desc" },
        },
      },
    });

    return this.mapShipment(row);
  }

  public async upsertShipmentSpecification(params: {
    workspaceId: string;
    shipmentId: string;
    inputPayload: unknown;
    calculationPayload: unknown;
  }): Promise<ShipmentEntity> {
    const prisma = PrismaClientManager.getClient();

    const shipment = await prisma.shipment.findFirst({
      where: {
        workspace_id: params.workspaceId,
        id: params.shipmentId,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (!shipment) {
      throw new AppError("Shipment not found.", "SHIPMENT_NOT_FOUND", 404);
    }

    await prisma.shipmentSpecification.upsert({
      where: {
        shipment_id: params.shipmentId,
      },
      update: {
        input_payload: params.inputPayload as never,
        calculation_payload: params.calculationPayload as never,
      },
      create: {
        workspace_id: params.workspaceId,
        shipment_id: params.shipmentId,
        input_payload: params.inputPayload as never,
        calculation_payload: params.calculationPayload as never,
      },
    });

    const refreshed = await this.findShipmentById(params.workspaceId, params.shipmentId);
    if (!refreshed) {
      throw new AppError("Shipment not found.", "SHIPMENT_NOT_FOUND", 404);
    }

    return refreshed;
  }

  public async replaceShipmentItems(params: {
    workspaceId: string;
    shipmentId: string;
    items: Array<{
      sku: string | null;
      description: string;
      quantity: number;
      unit: string | null;
      weightKg: number | null;
    }>;
  }): Promise<ShipmentEntity> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.shipment.findFirst({
      where: {
        workspace_id: params.workspaceId,
        id: params.shipmentId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("Shipment not found.", "SHIPMENT_NOT_FOUND", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.shipmentItem.deleteMany({
        where: {
          shipment_id: params.shipmentId,
        },
      });

      if (params.items.length > 0) {
        await tx.shipmentItem.createMany({
          data: params.items.map((item) => ({
            shipment_id: params.shipmentId,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            weight_kg: item.weightKg,
          })),
        });
      }
    });

    const refreshed = await this.findShipmentById(params.workspaceId, params.shipmentId);
    if (!refreshed) {
      throw new AppError("Shipment not found.", "SHIPMENT_NOT_FOUND", 404);
    }

    return refreshed;
  }

  public async addShipmentEvent(params: {
    workspaceId: string;
    shipmentId: string;
    statusKey: string | null;
    eventType: string;
    payload: unknown;
    actorUserId: string | null;
  }): Promise<ShipmentEntity> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.shipment.findFirst({
      where: {
        workspace_id: params.workspaceId,
        id: params.shipmentId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError("Shipment not found.", "SHIPMENT_NOT_FOUND", 404);
    }

    const status = params.statusKey
      ? await prisma.shipmentStatus.findFirst({
          where: {
            workspace_id: params.workspaceId,
            key: params.statusKey,
          },
          select: { id: true },
        })
      : null;

    if (params.statusKey && !status) {
      throw new AppError(`Shipment status '${params.statusKey}' not found.`, "SHIPMENT_STATUS_NOT_FOUND", 404);
    }

    await prisma.shipmentEvent.create({
      data: {
        shipment_id: params.shipmentId,
        status_id: status?.id ?? null,
        event_type: params.eventType,
        payload: params.payload as never,
        actor_user_id: params.actorUserId,
      },
    });

    const refreshed = await this.findShipmentById(params.workspaceId, params.shipmentId);
    if (!refreshed) {
      throw new AppError("Shipment not found.", "SHIPMENT_NOT_FOUND", 404);
    }

    return refreshed;
  }

  public async softDeleteByProjectVersionId(workspaceId: string, projectVersionId: number): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.shipment.updateMany({
      where: {
        workspace_id: workspaceId,
        project_version_id: projectVersionId,
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
      },
    });
  }

  private mapShipment(row: {
    id: string;
    workspace_id: string;
    code: string;
    client_id: string | null;
    notes: string | null;
    created_at: Date;
    status: { key: string };
    client: { first_name: string; last_name: string | null } | null;
    project_version: {
      id: number;
      version_label: string;
      project: {
        id: string;
        name: string;
      };
    };
    specification?:
      | {
          input_payload?: unknown;
          calculation_payload?: unknown;
          updated_at: Date;
        }
      | null;
    shipment_items?: Array<{
      id: number;
      sku: string | null;
      description: string;
      quantity: unknown;
      unit: string | null;
      weight_kg: unknown | null;
    }>;
    shipment_events?: Array<{
      id: number;
      event_type: string;
      payload: unknown | null;
      actor_user_id: string | null;
      occurred_at: Date;
      status?: { key: string } | null;
    }>;
  }): ShipmentEntity {
    return new ShipmentEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_version.project.id,
      projectName: row.project_version.project.name,
      projectVersionId: row.project_version.id,
      projectVersionLabel: row.project_version.version_label,
      code: row.code,
      clientId: row.client_id,
      clientName: row.client ? [row.client.first_name, row.client.last_name ?? ""].join(" ").trim() : null,
      statusKey: row.status.key,
      notes: row.notes,
      specificationInput: row.specification && "input_payload" in row.specification ? row.specification.input_payload ?? null : null,
      specificationCalculation:
        row.specification && "calculation_payload" in row.specification ? row.specification.calculation_payload ?? null : null,
      specificationUpdatedAt: row.specification?.updated_at ?? null,
      items: (row.shipment_items ?? []).map((item) => ({
        id: item.id,
        sku: item.sku,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        weightKg: item.weight_kg == null ? null : Number(item.weight_kg),
      })),
      events: (row.shipment_events ?? []).map((event) => ({
        id: event.id,
        eventType: event.event_type,
        statusKey: event.status?.key ?? null,
        payload: event.payload ?? null,
        actorUserId: event.actor_user_id,
        occurredAt: event.occurred_at,
      })),
      createdAt: row.created_at,
    });
  }
}
