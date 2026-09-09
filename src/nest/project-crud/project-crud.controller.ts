import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { CreateClientCommand } from "../../modules/clients/dto/CreateClientCommand.js";
import { UpdateClientCommand } from "../../modules/clients/dto/UpdateClientCommand.js";
import { ClientEntity } from "../../modules/clients/domain/ClientEntity.js";
import { ClientService } from "../../modules/clients/services/ClientService.js";
import { CompanyService } from "../../modules/companies/services/CompanyService.js";
import { CompanyGeocodingService } from "../../modules/companies/services/CompanyGeocodingService.js";
import { CompanyEntity } from "../../modules/companies/domain/CompanyEntity.js";
import { CreateCompanyCommand } from "../../modules/companies/dto/CreateCompanyCommand.js";
import { UpdateCompanyCommand } from "../../modules/companies/dto/UpdateCompanyCommand.js";
import { CreateProjectAuthorCommand } from "../../modules/project-authors/dto/CreateProjectAuthorCommand.js";
import { UpdateProjectAuthorCommand } from "../../modules/project-authors/dto/UpdateProjectAuthorCommand.js";
import { ProjectAuthorService } from "../../modules/project-authors/services/ProjectAuthorService.js";
import { CreateProjectRevisionCommand } from "../../modules/project-revisions/dto/CreateProjectRevisionCommand.js";
import { UpdateProjectRevisionCommand } from "../../modules/project-revisions/dto/UpdateProjectRevisionCommand.js";
import { ProjectRevisionService } from "../../modules/project-revisions/services/ProjectRevisionService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const companyPayloadSchema = z.object({
  name: z.string().min(2),
  isHeadquarters: z.boolean().optional().default(false),
  legalName: z.string().trim().optional().default(""),
  vatNumber: z.string().trim().optional().default(""),
  taxCode: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  website: z.string().trim().optional().default(""),
  industry: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  postalCode: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  province: z.string().trim().optional().default(""),
  country: z.string().trim().optional().default(""),
  latitude: z.string().trim().optional().default(""),
  longitude: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

const companyGeocodingPayloadSchema = z.object({
  address: z.string().trim().min(1),
  postalCode: z.string().trim().optional().default(""),
  city: z.string().trim().min(1),
  province: z.string().trim().optional().default(""),
  country: z.string().trim().optional().default("Italia"),
});

const deleteCompanySchema = z.object({
  confirmText: z.string().min(1),
});

const permanentDeleteSchema = z.object({
  confirmText: z.string().min(1),
});

const clientPayloadSchema = z.object({
  name: z.string().min(2),
  companyId: z.number().int().positive().nullable().optional(),
  role: z.string().trim().optional().default(""),
  department: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  mobile: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  province: z.string().trim().optional().default(""),
  country: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

const deleteClientSchema = z.object({
  confirmText: z.string().min(1),
});

const projectAuthorPayloadSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().trim().optional().default(""),
  displayName: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

const deleteProjectAuthorSchema = z.object({
  confirmText: z.string().min(1),
});

const projectRevisionPayloadSchema = z.object({
  code: z.string().min(1),
});

const deleteProjectRevisionSchema = z.object({
  confirmText: z.string().min(1),
});

@Controller()
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.PROJECT_MANAGEMENT)
export class NestProjectCrudController {
  public constructor(
    @Inject(CompanyService)
    private readonly companyService: CompanyService,
    @Inject(CompanyGeocodingService)
    private readonly companyGeocodingService: CompanyGeocodingService,
    @Inject(ClientService)
    private readonly clientService: ClientService,
    @Inject(ProjectAuthorService)
    private readonly projectAuthorService: ProjectAuthorService,
    @Inject(ProjectRevisionService)
    private readonly projectRevisionService: ProjectRevisionService,
  ) {}

  @Post("/api/companies/geocode")
  @HttpCode(200)
  @RequirePermission(PermissionKey.CLIENTS_WRITE)
  public async geocodeCompany(@Body() bodyRaw: unknown): Promise<Record<string, unknown>> {
    return { ...await this.companyGeocodingService.geocode(companyGeocodingPayloadSchema.parse(bodyRaw)) };
  }

  @Get("/api/companies")
  @RequirePermission(PermissionKey.CLIENTS_READ)
  public async listCompanies(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    const items = await this.companyService.list(requestContext.workspace.workspaceId);
    return items.map((item) => this.serializeCompany(item));
  }

  @Get("/api/companies/:companyId")
  @RequirePermission(PermissionKey.CLIENTS_READ)
  public async getCompanyById(
    @Param("companyId") companyIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const item = await this.companyService.getById(
      requestContext.workspace.workspaceId,
      this.getCompanyId(companyIdRaw),
    );

    const clients = await this.clientService.list(requestContext.workspace.workspaceId);
    return {
      ...this.serializeCompany(item),
      clients: clients
        .filter((client) => client.companyId === item.id)
        .map((client) => this.serializeClient(client)),
    };
  }

  @Post("/api/companies")
  @HttpCode(201)
  @RequirePermission(PermissionKey.CLIENTS_WRITE)
  public async createCompany(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = companyPayloadSchema.parse(bodyRaw);
    const created = await this.companyService.create(
      new CreateCompanyCommand({
        workspaceId: requestContext.workspace.workspaceId,
        name: body.name,
        isHeadquarters: body.isHeadquarters,
        legalName: body.legalName,
        vatNumber: body.vatNumber,
        taxCode: body.taxCode,
        email: body.email,
        phone: body.phone,
        website: body.website,
        industry: body.industry,
        address: body.address,
        postalCode: body.postalCode,
        city: body.city,
        province: body.province,
        country: body.country,
        latitude: body.latitude,
        longitude: body.longitude,
        notes: body.notes,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return this.serializeCompany(created);
  }

  @Patch("/api/companies/:companyId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.CLIENTS_WRITE)
  public async updateCompany(
    @Param("companyId") companyIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = companyPayloadSchema.parse(bodyRaw);
    const updated = await this.companyService.update(
      new UpdateCompanyCommand({
        workspaceId: requestContext.workspace.workspaceId,
        companyId: this.getCompanyId(companyIdRaw),
        name: body.name,
        isHeadquarters: body.isHeadquarters,
        legalName: body.legalName,
        vatNumber: body.vatNumber,
        taxCode: body.taxCode,
        email: body.email,
        phone: body.phone,
        website: body.website,
        industry: body.industry,
        address: body.address,
        postalCode: body.postalCode,
        city: body.city,
        province: body.province,
        country: body.country,
        latitude: body.latitude,
        longitude: body.longitude,
        notes: body.notes,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return this.serializeCompany(updated);
  }

  @Delete("/api/companies/:companyId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.CLIENTS_WRITE)
  public async deleteCompany(
    @Param("companyId") companyIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteCompanySchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const companyId = this.getCompanyId(companyIdRaw);
    await this.companyService.delete(
      requestContext.workspace.workspaceId,
      companyId,
      requestContext.workspace.userId,
    );
    return { ok: true, id: companyId };
  }

  @Delete("/api/companies/:companyId/permanent")
  @HttpCode(200)
  @RequirePermission(PermissionKey.CLIENTS_DELETE_PERMANENTLY)
  public async permanentlyDeleteCompany(
    @Param("companyId") companyIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = permanentDeleteSchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "elimina definitivamente") {
      throw new AppError("Conferma non valida: digita 'elimina definitivamente'.", "DELETE_CONFIRMATION_INVALID", 400);
    }

    const companyId = this.getCompanyId(companyIdRaw);
    await this.companyService.permanentlyDelete(requestContext.workspace.workspaceId, companyId, requestContext.workspace.userId);
    return { ok: true, id: companyId };
  }

  @Get("/api/clients")
  @RequirePermission(PermissionKey.CLIENTS_READ)
  public async listClients(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    const clients = await this.clientService.list(requestContext.workspace.workspaceId);
    return clients.map((item) => this.serializeClient(item));
  }

  @Get("/api/clients/:clientId")
  @RequirePermission(PermissionKey.CLIENTS_READ)
  public async getClientById(
    @Param("clientId") clientIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const client = await this.clientService.getById(
      requestContext.workspace.workspaceId,
      this.getClientId(clientIdRaw),
    );

    return this.serializeClient(client);
  }

  @Post("/api/clients")
  @HttpCode(201)
  @RequirePermission(PermissionKey.CLIENTS_WRITE)
  public async createClient(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = clientPayloadSchema.parse(bodyRaw);
    const created = await this.clientService.create(
      new CreateClientCommand({
        workspaceId: requestContext.workspace.workspaceId,
        name: body.name,
        companyId: body.companyId ?? null,
        role: body.role,
        department: body.department,
        email: body.email,
        phone: body.phone,
        mobile: body.mobile,
        address: body.address,
        city: body.city,
        province: body.province,
        country: body.country,
        notes: body.notes,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return this.serializeClient(created);
  }

  @Patch("/api/clients/:clientId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.CLIENTS_WRITE)
  public async updateClient(
    @Param("clientId") clientIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = clientPayloadSchema.parse(bodyRaw);
    const updated = await this.clientService.update(
      new UpdateClientCommand({
        workspaceId: requestContext.workspace.workspaceId,
        clientId: this.getClientId(clientIdRaw),
        name: body.name,
        companyId: body.companyId ?? null,
        role: body.role,
        department: body.department,
        email: body.email,
        phone: body.phone,
        mobile: body.mobile,
        address: body.address,
        city: body.city,
        province: body.province,
        country: body.country,
        notes: body.notes,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return this.serializeClient(updated);
  }

  @Delete("/api/clients/:clientId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.CLIENTS_WRITE)
  public async deleteClient(
    @Param("clientId") clientIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteClientSchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const clientId = this.getClientId(clientIdRaw);
    await this.clientService.delete(
      requestContext.workspace.workspaceId,
      clientId,
      requestContext.workspace.userId,
    );

    return { ok: true, id: clientId };
  }

  @Delete("/api/clients/:clientId/permanent")
  @HttpCode(200)
  @RequirePermission(PermissionKey.CLIENTS_DELETE_PERMANENTLY)
  public async permanentlyDeleteClient(
    @Param("clientId") clientIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = permanentDeleteSchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "elimina definitivamente") {
      throw new AppError("Conferma non valida: digita 'elimina definitivamente'.", "DELETE_CONFIRMATION_INVALID", 400);
    }

    const clientId = this.getClientId(clientIdRaw);
    await this.clientService.permanentlyDelete(requestContext.workspace.workspaceId, clientId, requestContext.workspace.userId);
    return { ok: true, id: clientId };
  }

  @Get("/api/project-authors")
  @RequirePermission(PermissionKey.PROJECTS_READ)
  public async listProjectAuthors(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    const items = await this.projectAuthorService.list(requestContext.workspace.workspaceId);
    return items.map((item) => ({
      id: item.id,
      firstName: item.firstName,
      lastName: item.lastName,
      displayName: item.displayName,
      notes: item.notes,
    }));
  }

  @Get("/api/project-authors/:authorId")
  @RequirePermission(PermissionKey.PROJECTS_READ)
  public async getProjectAuthorById(
    @Param("authorId") authorIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const item = await this.projectAuthorService.getById(
      requestContext.workspace.workspaceId,
      this.getNumericId(authorIdRaw, "Project author ID is invalid.", "PROJECT_AUTHOR_ID_INVALID"),
    );

    return {
      id: item.id,
      firstName: item.firstName,
      lastName: item.lastName,
      displayName: item.displayName,
      notes: item.notes,
    };
  }

  @Post("/api/project-authors")
  @HttpCode(201)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async createProjectAuthor(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = projectAuthorPayloadSchema.parse(bodyRaw);
    const created = await this.projectAuthorService.create(
      new CreateProjectAuthorCommand({
        workspaceId: requestContext.workspace.workspaceId,
        firstName: body.firstName,
        lastName: body.lastName,
        displayName: body.displayName,
        notes: body.notes,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return {
      id: created.id,
      firstName: created.firstName,
      lastName: created.lastName,
      displayName: created.displayName,
      notes: created.notes,
    };
  }

  @Patch("/api/project-authors/:authorId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async updateProjectAuthor(
    @Param("authorId") authorIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = projectAuthorPayloadSchema.parse(bodyRaw);
    const updated = await this.projectAuthorService.update(
      new UpdateProjectAuthorCommand({
        workspaceId: requestContext.workspace.workspaceId,
        authorId: this.getNumericId(authorIdRaw, "Project author ID is invalid.", "PROJECT_AUTHOR_ID_INVALID"),
        firstName: body.firstName,
        lastName: body.lastName,
        displayName: body.displayName,
        notes: body.notes,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      displayName: updated.displayName,
      notes: updated.notes,
    };
  }

  @Delete("/api/project-authors/:authorId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async deleteProjectAuthor(
    @Param("authorId") authorIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteProjectAuthorSchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const authorId = this.getNumericId(authorIdRaw, "Project author ID is invalid.", "PROJECT_AUTHOR_ID_INVALID");
    await this.projectAuthorService.delete(
      requestContext.workspace.workspaceId,
      authorId,
      requestContext.workspace.userId,
    );

    return { ok: true, id: authorId };
  }

  @Get("/api/project-revisions")
  @RequirePermission(PermissionKey.PROJECTS_READ)
  public async listProjectRevisions(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    const items = await this.projectRevisionService.list(requestContext.workspace.workspaceId);
    return items.map((item) => ({ id: item.id, code: item.code, createdAt: item.createdAt }));
  }

  @Get("/api/project-revisions/:revisionId")
  @RequirePermission(PermissionKey.PROJECTS_READ)
  public async getProjectRevisionById(
    @Param("revisionId") revisionIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const item = await this.projectRevisionService.getById(
      requestContext.workspace.workspaceId,
      this.getNumericId(revisionIdRaw, "Project revision ID is invalid.", "PROJECT_REVISION_ID_INVALID"),
    );

    return { id: item.id, code: item.code, createdAt: item.createdAt };
  }

  @Post("/api/project-revisions")
  @HttpCode(201)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async createProjectRevision(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = projectRevisionPayloadSchema.parse(bodyRaw);
    const created = await this.projectRevisionService.create(
      new CreateProjectRevisionCommand({
        workspaceId: requestContext.workspace.workspaceId,
        code: body.code,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return { id: created.id, code: created.code, createdAt: created.createdAt };
  }

  @Patch("/api/project-revisions/:revisionId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async updateProjectRevision(
    @Param("revisionId") revisionIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = projectRevisionPayloadSchema.parse(bodyRaw);
    const updated = await this.projectRevisionService.update(
      new UpdateProjectRevisionCommand({
        workspaceId: requestContext.workspace.workspaceId,
        revisionId: this.getNumericId(revisionIdRaw, "Project revision ID is invalid.", "PROJECT_REVISION_ID_INVALID"),
        code: body.code,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return { id: updated.id, code: updated.code, createdAt: updated.createdAt };
  }

  @Delete("/api/project-revisions/:revisionId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async deleteProjectRevision(
    @Param("revisionId") revisionIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteProjectRevisionSchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const revisionId = this.getNumericId(revisionIdRaw, "Project revision ID is invalid.", "PROJECT_REVISION_ID_INVALID");
    await this.projectRevisionService.delete(
      requestContext.workspace.workspaceId,
      revisionId,
      requestContext.workspace.userId,
    );

    return { ok: true, id: revisionId };
  }

  private serializeCompany(item: CompanyEntity): Record<string, unknown> {
    return {
      id: item.id,
      name: item.name,
      isHeadquarters: item.isHeadquarters,
      legalName: item.legalName,
      vatNumber: item.vatNumber,
      taxCode: item.taxCode,
      email: item.email,
      phone: item.phone,
      website: item.website,
      industry: item.industry,
      address: item.address,
      postalCode: item.postalCode,
      city: item.city,
      province: item.province,
      country: item.country,
      latitude: item.latitude,
      longitude: item.longitude,
      notes: item.notes,
    };
  }

  private serializeClient(item: ClientEntity): Record<string, unknown> {
    return {
      id: item.id,
      name: item.name,
      companyId: item.companyId,
      companyName: item.companyName,
      role: item.role,
      department: item.department,
      email: item.email,
      phone: item.phone,
      mobile: item.mobile,
      address: item.address,
      city: item.city,
      province: item.province,
      country: item.country,
      notes: item.notes,
    };
  }

  private getCompanyId(value: string): number {
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError("Company ID is invalid.", "COMPANY_ID_INVALID", 400);
    }

    return parsed;
  }

  private getClientId(value: string): string {
    if (!value || !value.trim()) {
      throw new AppError("Client ID is required.", "CLIENT_ID_REQUIRED", 400);
    }

    return value.trim();
  }

  private getNumericId(value: string, message: string, code: string): number {
    const parsed = Number.parseInt(value ?? "", 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError(message, code, 400);
    }

    return parsed;
  }
}
