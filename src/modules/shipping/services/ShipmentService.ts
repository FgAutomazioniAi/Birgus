import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { NotificationService } from "../../notifications/services/NotificationService.js";
import { ShipmentEntity } from "../domain/ShipmentEntity.js";
import { CreateShipmentCommand } from "../dto/CreateShipmentCommand.js";
import { ShipmentRepository } from "../repositories/ShipmentRepository.js";

export class ShipmentService {
  private readonly repository: ShipmentRepository;
  private readonly notificationService: NotificationService | null;
  private static readonly DEFAULT_STATUS_KEY = "draft";

  public constructor(repository: ShipmentRepository, notificationService?: NotificationService | null) {
    this.repository = repository;
    this.notificationService = notificationService ?? null;
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

    const created = await this.repository.createShipment({
      workspaceId: command.workspaceId,
      projectVersionId: command.projectVersionId,
      code: shipmentCode,
      clientId: versionSummary.clientId,
      statusKey: command.statusKey || ShipmentService.DEFAULT_STATUS_KEY,
      notes: command.notes,
      createdByUserId: command.createdByUserId,
    });

    await this.notify(
      command.workspaceId,
      "Spedizione creata",
      `Creata la spedizione ${created.code} per la versione ${versionSummary.projectVersionLabel.toUpperCase()}.`,
    );

    return created;
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
    const updated = await this.repository.upsertShipmentSpecification(params);
    await this.notify(
      params.workspaceId,
      "Specifica spedizione aggiornata",
      `Aggiornata la configurazione della spedizione ${updated.code}.`,
    );
    return updated;
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
    const updated = await this.repository.replaceShipmentItems(params);
    await this.notify(
      params.workspaceId,
      "Articoli spedizione aggiornati",
      `Aggiornati gli articoli della spedizione ${updated.code}.`,
    );
    return updated;
  }

  public async addShipmentEvent(params: {
    workspaceId: string;
    shipmentId: string;
    statusKey: string | null;
    eventType: string;
    payload: unknown;
    actorUserId: string | null;
  }): Promise<ShipmentEntity> {
    const updated = await this.repository.addShipmentEvent(params);
    await this.notify(
      params.workspaceId,
      "Evento spedizione registrato",
      `Registrato l'evento "${params.eventType}" per la spedizione ${updated.code}.`,
    );
    return updated;
  }

  private buildDefaultCode(projectVersionId: number, versionLabel: string): string {
    return `SP-PV${projectVersionId}-${versionLabel.toUpperCase()}`;
  }

  private async notify(workspaceId: string, title: string, message: string): Promise<void> {
    if (!this.notificationService) {
      return;
    }

    try {
      await this.notificationService.createInfo({
        workspaceId,
        userId: null,
        moduleKey: ModuleKey.SHIPMENT_MANAGEMENT,
        title,
        message,
      });
    } catch (error) {
      console.error("[ShipmentService] Unable to create notification", { workspaceId, title, message, error });
    }
  }
}
