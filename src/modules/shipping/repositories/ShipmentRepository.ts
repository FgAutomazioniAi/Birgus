import { ShipmentEntity } from "../domain/ShipmentEntity.js";

export interface ShipmentProjectVersionSummary {
  workspaceId: string;
  projectId: string;
  projectName: string;
  projectVersionId: number;
  projectVersionLabel: string;
  clientId: string | null;
  clientName: string | null;
}

export interface ShipmentRepository {
  listShipments(workspaceId: string): Promise<ShipmentEntity[]>;
  findShipmentById(workspaceId: string, shipmentId: string): Promise<ShipmentEntity | null>;
  findByProjectVersionId(workspaceId: string, projectVersionId: number): Promise<ShipmentEntity | null>;
  findProjectVersionSummary(workspaceId: string, projectVersionId: number): Promise<ShipmentProjectVersionSummary | null>;
  createShipment(params: {
    workspaceId: string;
    projectVersionId: number;
    code: string;
    clientId: string | null;
    statusKey: string;
    notes: string | null;
    createdByUserId: string | null;
  }): Promise<ShipmentEntity>;
  upsertShipmentSpecification(params: {
    workspaceId: string;
    shipmentId: string;
    inputPayload: unknown;
    calculationPayload: unknown;
  }): Promise<ShipmentEntity>;
  softDeleteByProjectVersionId(workspaceId: string, projectVersionId: number): Promise<void>;
}
