import { AppError } from "../../../core/errors/AppError.js";
import { ClientEntity } from "../domain/ClientEntity.js";
import { CreateClientCommand } from "../dto/CreateClientCommand.js";
import { UpdateClientCommand } from "../dto/UpdateClientCommand.js";
import { ClientRepository } from "../repositories/ClientRepository.js";

export class ClientService {
  private readonly repository: ClientRepository;

  public constructor(repository: ClientRepository) {
    this.repository = repository;
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

    return this.repository.create({
      workspaceId: command.workspaceId,
      name,
      email: command.email,
      phone: command.phone,
      notes: command.notes,
    });
  }

  public async update(command: UpdateClientCommand): Promise<ClientEntity> {
    const name = this.normalizeName(command.name);
    const updated = await this.repository.update({
      workspaceId: command.workspaceId,
      clientId: command.clientId,
      name,
      email: command.email,
      phone: command.phone,
      notes: command.notes,
    });

    if (!updated) {
      throw new AppError("Client not found.", "CLIENT_NOT_FOUND", 404);
    }

    return updated;
  }

  public async delete(workspaceId: string, clientId: string): Promise<void> {
    const removed = await this.repository.softDelete(workspaceId, clientId);
    if (!removed) {
      throw new AppError("Client not found.", "CLIENT_NOT_FOUND", 404);
    }
  }

  private normalizeName(name: string): string {
    const value = name.trim().replace(/\s+/g, " ");
    if (value.length < 2) {
      throw new AppError("Client name is too short.", "CLIENT_NAME_INVALID", 400);
    }

    return value;
  }
}
