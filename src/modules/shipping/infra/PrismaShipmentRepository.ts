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
      createdAt: row.created_at,
    });
  }
}
