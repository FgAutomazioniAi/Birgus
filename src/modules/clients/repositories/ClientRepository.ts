import { ClientEntity } from "../domain/ClientEntity.js";

export interface ClientRepository {
  list(workspaceId: string): Promise<ClientEntity[]>;
  findById(workspaceId: string, clientId: string): Promise<ClientEntity | null>;
  create(params: {
    workspaceId: string;
    name: string;
    companyId: number | null;
    email: string;
    phone: string;
    notes: string;
  }): Promise<ClientEntity>;
  update(params: {
    workspaceId: string;
    clientId: string;
    name: string;
    companyId: number | null;
    email: string;
    phone: string;
    notes: string;
  }): Promise<ClientEntity | null>;
  softDelete(workspaceId: string, clientId: string): Promise<boolean>;
}
