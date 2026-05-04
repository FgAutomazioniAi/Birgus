import { AppError } from "../../../core/errors/AppError.js";
import { ShipmentEntity } from "../domain/ShipmentEntity.js";
import { CreateShipmentCommand } from "../dto/CreateShipmentCommand.js";
import { ShipmentRepository } from "../repositories/ShipmentRepository.js";

export class ShipmentService {
  private readonly repository: ShipmentRepository;
  private static readonly DEFAULT_STATUS_KEY = "draft";

  public constructor(repository: ShipmentRepository) {
    this.repository = repository;
  }

  public async listShipments(workspaceId: string): Promise<ShipmentEntity[]> {
    return this.repository.listShipments(workspaceId);
  }

  public async getShipment(workspaceId: string, shipmentId: string): Promise<ShipmentEntity> {
    const shipment = await this.repository.findShipmentById(workspaceId, shipmentId);
    if (!shipment) {
      throw new AppError("Shipment not found.", "SHIPMENT_NOT_FOUND", 404);
    }

    return shipment;
  }

  public async createShipment(command: CreateShipmentCommand): Promise<ShipmentEntity> {
    const versionSummary = await this.repository.findProjectVersionSummary(command.workspaceId, command.projectVersionId);
    if (!versionSummary) {
      throw new AppError("Project version not found.", "PROJECT_VERSION_NOT_FOUND", 404);
    }

    const existing = await this.repository.findByProjectVersionId(command.workspaceId, command.projectVersionId);
    if (existing) {
      throw new AppError(
        `Project version '${versionSummary.projectVersionLabel}' already has a shipment.`,
        "SHIPMENT_ALREADY_LINKED_TO_VERSION",
        409,
      );
    }

    const shipmentCode = command.code ?? this.buildDefaultCode(versionSummary.projectVersionId, versionSummary.projectVersionLabel);
    if (shipmentCode.length < 2) {
      throw new AppError("Shipment code is invalid.", "SHIPMENT_CODE_INVALID", 400);
    }

    return this.repository.createShipment({
      workspaceId: command.workspaceId,
      projectVersionId: command.projectVersionId,
      code: shipmentCode,
      clientId: versionSummary.clientId,
      statusKey: command.statusKey || ShipmentService.DEFAULT_STATUS_KEY,
      notes: command.notes,
      createdByUserId: command.createdByUserId,
    });
  }

  public async deleteShipmentForProjectVersion(workspaceId: string, projectVersionId: number): Promise<void> {
    await this.repository.softDeleteByProjectVersionId(workspaceId, projectVersionId);
  }

  public async saveShipmentSpecification(params: {
    workspaceId: string;
    shipmentId: string;
    inputPayload: unknown;
    calculationPayload: unknown;
  }): Promise<ShipmentEntity> {
    return this.repository.upsertShipmentSpecification(params);
  }

  private buildDefaultCode(projectVersionId: number, versionLabel: string): string {
    return `SP-PV${projectVersionId}-${versionLabel.toUpperCase()}`;
  }
}
