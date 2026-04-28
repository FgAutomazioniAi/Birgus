import { ShipmentEntity } from "../domain/ShipmentEntity.js";

export interface ShipmentRepository {
  listShipments(workspaceId: string): Promise<ShipmentEntity[]>;
  createShipment(params: {
    workspaceId: string;
    code: string;
    clientId: string | null;
    statusKey: string;
    notes: string | null;
    createdByUserId: string | null;
  }): Promise<ShipmentEntity>;
}
