import { ClientEntity } from "../domain/ClientEntity.js";

export interface ClientRepository {
  list(workspaceId: string): Promise<ClientEntity[]>;
  findById(workspaceId: string, clientId: string): Promise<ClientEntity | null>;
  create(params: {
    workspaceId: string;
    name: string;
    companyId: number | null;
    role: string;
    department: string;
    email: string;
    phone: string;
    mobile: string;
    address: string;
    city: string;
    province: string;
    country: string;
    notes: string;
  }): Promise<ClientEntity>;
  update(params: {
    workspaceId: string;
    clientId: string;
    name: string;
    companyId: number | null;
    role: string;
    department: string;
    email: string;
    phone: string;
    mobile: string;
    address: string;
    city: string;
    province: string;
    country: string;
    notes: string;
  }): Promise<ClientEntity | null>;
  softDelete(workspaceId: string, clientId: string): Promise<boolean>;
}
