import { AppError } from "../../../core/errors/AppError.js";
import { ShipmentEntity } from "../domain/ShipmentEntity.js";
import { CreateShipmentCommand } from "../dto/CreateShipmentCommand.js";
import { ShipmentRepository } from "../repositories/ShipmentRepository.js";

export class ShipmentService {
  private readonly repository: ShipmentRepository;

  public constructor(repository: ShipmentRepository) {
    this.repository = repository;
  }

  public async listShipments(workspaceId: string): Promise<ShipmentEntity[]> {
    return this.repository.listShipments(workspaceId);
  }

  public async createShipment(command: CreateShipmentCommand): Promise<ShipmentEntity> {
    if (!command.code || command.code.length < 2) {
      throw new AppError("Shipment code is invalid.", "SHIPMENT_CODE_INVALID", 400);
    }

    return this.repository.createShipment({
      workspaceId: command.workspaceId,
      code: command.code,
      clientId: command.clientId,
      statusKey: command.statusKey,
      notes: command.notes,
      createdByUserId: command.createdByUserId,
    });
  }
}
