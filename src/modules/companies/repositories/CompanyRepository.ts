import { CompanyEntity } from "../domain/CompanyEntity.js";

export interface CompanyRepository {
  list(workspaceId: string): Promise<CompanyEntity[]>;
  findById(workspaceId: string, companyId: number): Promise<CompanyEntity | null>;
  create(params: {
    workspaceId: string;
    name: string;
    isHeadquarters: boolean;
    legalName: string;
    vatNumber: string;
    taxCode: string;
    email: string;
    phone: string;
    website: string;
    industry: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
    latitude: string;
    longitude: string;
    notes: string;
  }): Promise<CompanyEntity>;
  update(params: {
    workspaceId: string;
    companyId: number;
    name: string;
    isHeadquarters: boolean;
    legalName: string;
    vatNumber: string;
    taxCode: string;
    email: string;
    phone: string;
    website: string;
    industry: string;
    address: string;
    postalCode: string;
    city: string;
    province: string;
    country: string;
    latitude: string;
    longitude: string;
    notes: string;
  }): Promise<CompanyEntity | null>;
  softDelete(workspaceId: string, companyId: number): Promise<boolean>;
}
