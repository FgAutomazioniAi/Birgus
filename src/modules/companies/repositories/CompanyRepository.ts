import { CompanyEntity } from "../domain/CompanyEntity.js";

export interface CompanyRepository {
  list(workspaceId: string): Promise<CompanyEntity[]>;
  findById(workspaceId: string, companyId: number): Promise<CompanyEntity | null>;
  create(params: {
    workspaceId: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
  }): Promise<CompanyEntity>;
  update(params: {
    workspaceId: string;
    companyId: number;
    name: string;
    address: string;
    postalCode: string;
    city: string;
  }): Promise<CompanyEntity | null>;
  softDelete(workspaceId: string, companyId: number): Promise<boolean>;
}
