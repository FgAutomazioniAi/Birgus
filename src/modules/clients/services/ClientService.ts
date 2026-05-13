import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { AuditLogService } from "../../audit/services/AuditLogService.js";
import { ClientEntity } from "../domain/ClientEntity.js";
import { CreateClientCommand } from "../dto/CreateClientCommand.js";
import { UpdateClientCommand } from "../dto/UpdateClientCommand.js";
import { ClientRepository } from "../repositories/ClientRepository.js";

export class ClientService {
  private readonly repository: ClientRepository;
  private readonly auditLogService: AuditLogService | null;

  public constructor(repository: ClientRepository, auditLogService?: AuditLogService | null) {
    this.repository = repository;
    this.auditLogService = auditLogService ?? null;
  }

  public async list(workspaceId: string): Promise<ClientEntity[]> {
    return this.repository.list(workspaceId);
  }

  public async getById(workspaceId: string, clientId: string): Promise<ClientEntity> {
    const item = await this.repository.findById(workspaceId, clientId);
    if (!item) {
      throw new AppError("Client not found.", "CLIENT_NOT_FOUND", 404);
    }

    return item;
  }

  public async create(command: CreateClientCommand): Promise<ClientEntity> {
    const name = this.normalizeName(command.name);
    let created: ClientEntity;
    try {
      created = await this.repository.create({
        workspaceId: command.workspaceId,
        name,
        companyId: command.companyId,
        email: command.email,
        phone: command.phone,
        notes: command.notes,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
        throw new AppError("Company not found.", "COMPANY_NOT_FOUND", 404);
      }

      throw error;
    }

    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.actorUserId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "client.create",
      entityType: "Client",
      entityId: created.id,
      payload: {
        name: created.name,
        companyId: created.companyId,
      },
    });

    return created;
  }

  public async update(command: UpdateClientCommand): Promise<ClientEntity> {
    const name = this.normalizeName(command.name);
    let updated: ClientEntity | null;
    try {
      updated = await this.repository.update({
        workspaceId: command.workspaceId,
        clientId: command.clientId,
        name,
        companyId: command.companyId,
        email: command.email,
        phone: command.phone,
        notes: command.notes,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
        throw new AppError("Company not found.", "COMPANY_NOT_FOUND", 404);
      }

      throw error;
    }

    if (!updated) {
      throw new AppError("Client not found.", "CLIENT_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.actorUserId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "client.update",
      entityType: "Client",
      entityId: updated.id,
      payload: {
        name: updated.name,
        companyId: updated.companyId,
      },
    });

    return updated;
  }

  public async delete(workspaceId: string, clientId: string, actorUserId?: string | null): Promise<void> {
    const removed = await this.repository.softDelete(workspaceId, clientId);
    if (!removed) {
      throw new AppError("Client not found.", "CLIENT_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId,
      userId: actorUserId ?? null,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "client.delete",
      entityType: "Client",
      entityId: clientId,
      payload: null,
    });
  }

  private normalizeName(name: string): string {
    const value = name.trim().replace(/\s+/g, " ");
    if (value.length < 2) {
      throw new AppError("Client name is too short.", "CLIENT_NAME_INVALID", 400);
    }

    return value;
  }
}
