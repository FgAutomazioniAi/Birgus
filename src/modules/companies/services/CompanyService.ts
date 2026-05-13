import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { AuditLogService } from "../../audit/services/AuditLogService.js";
import { CompanyEntity } from "../domain/CompanyEntity.js";
import { CreateCompanyCommand } from "../dto/CreateCompanyCommand.js";
import { UpdateCompanyCommand } from "../dto/UpdateCompanyCommand.js";
import { CompanyRepository } from "../repositories/CompanyRepository.js";

export class CompanyService {
  private readonly repository: CompanyRepository;
  private readonly auditLogService: AuditLogService | null;

  public constructor(repository: CompanyRepository, auditLogService?: AuditLogService | null) {
    this.repository = repository;
    this.auditLogService = auditLogService ?? null;
  }

  public async list(workspaceId: string): Promise<CompanyEntity[]> {
    return this.repository.list(workspaceId);
  }

  public async getById(workspaceId: string, companyId: number): Promise<CompanyEntity> {
    const item = await this.repository.findById(workspaceId, companyId);
    if (!item) {
      throw new AppError("Company not found.", "COMPANY_NOT_FOUND", 404);
    }

    return item;
  }

  public async create(command: CreateCompanyCommand): Promise<CompanyEntity> {
    const name = this.normalizeName(command.name);
    const company = await this.repository.create({
      workspaceId: command.workspaceId,
      name,
      address: command.address,
      postalCode: command.postalCode,
      city: command.city,
    });

    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.actorUserId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "company.create",
      entityType: "Company",
      entityId: null,
      payload: { companyId: company.id, name: company.name },
    });

    return company;
  }

  public async update(command: UpdateCompanyCommand): Promise<CompanyEntity> {
    const company = await this.repository.update({
      workspaceId: command.workspaceId,
      companyId: command.companyId,
      name: this.normalizeName(command.name),
      address: command.address,
      postalCode: command.postalCode,
      city: command.city,
    });

    if (!company) {
      throw new AppError("Company not found.", "COMPANY_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.actorUserId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "company.update",
      entityType: "Company",
      entityId: null,
      payload: { companyId: company.id, name: company.name },
    });

    return company;
  }

  public async delete(workspaceId: string, companyId: number, actorUserId?: string | null): Promise<void> {
    const removed = await this.repository.softDelete(workspaceId, companyId);
    if (!removed) {
      throw new AppError("Company not found.", "COMPANY_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId,
      userId: actorUserId ?? null,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "company.delete",
      entityType: "Company",
      entityId: null,
      payload: { companyId },
    });
  }

  private normalizeName(name: string): string {
    const value = name.trim().replace(/\s+/g, " ");
    if (value.length < 2) {
      throw new AppError("Company name is too short.", "COMPANY_NAME_INVALID", 400);
    }

    return value;
  }
}
