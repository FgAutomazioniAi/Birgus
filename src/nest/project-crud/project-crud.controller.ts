import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { CreateClientCommand } from "../../modules/clients/dto/CreateClientCommand.js";
import { UpdateClientCommand } from "../../modules/clients/dto/UpdateClientCommand.js";
import { ClientService } from "../../modules/clients/services/ClientService.js";
import { CompanyService } from "../../modules/companies/services/CompanyService.js";
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
  address: z.string().trim().optional().default(""),
  postalCode: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
});

const deleteCompanySchema = z.object({
  confirmText: z.string().min(1),
});

const clientPayloadSchema = z.object({
  name: z.string().min(2),
  companyId: z.number().int().positive().nullable().optional(),
  email: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
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
    @Inject(ClientService)
    private readonly clientService: ClientService,
    @Inject(ProjectAuthorService)
    private readonly projectAuthorService: ProjectAuthorService,
    @Inject(ProjectRevisionService)
    private readonly projectRevisionService: ProjectRevisionService,
  ) {}

  @Get("/api/companies")
  @RequirePermission(PermissionKey.CLIENTS_READ)
  public async listCompanies(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    const items = await this.companyService.list(requestContext.workspace.workspaceId);
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      address: item.address,
      postalCode: item.postalCode,
      city: item.city,
    }));
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

    return {
      id: item.id,
      name: item.name,
      address: item.address,
      postalCode: item.postalCode,
      city: item.city,
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
        address: body.address,
        postalCode: body.postalCode,
        city: body.city,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return {
      id: created.id,
      name: created.name,
      address: created.address,
      postalCode: created.postalCode,
      city: created.city,
    };
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
        address: body.address,
        postalCode: body.postalCode,
        city: body.city,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return {
      id: updated.id,
      name: updated.name,
      address: updated.address,
      postalCode: updated.postalCode,
      city: updated.city,
    };
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

  @Get("/api/clients")
  @RequirePermission(PermissionKey.CLIENTS_READ)
  public async listClients(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    const clients = await this.clientService.list(requestContext.workspace.workspaceId);
    return clients.map((item) => ({
      id: item.id,
      name: item.name,
      companyId: item.companyId,
      companyName: item.companyName,
      email: item.email,
      phone: item.phone,
      notes: item.notes,
    }));
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

    return {
      id: client.id,
      name: client.name,
      companyId: client.companyId,
      companyName: client.companyName,
      email: client.email,
      phone: client.phone,
      notes: client.notes,
    };
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
        email: body.email,
        phone: body.phone,
        notes: body.notes,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return {
      id: created.id,
      name: created.name,
      companyId: created.companyId,
      companyName: created.companyName,
      email: created.email,
      phone: created.phone,
      notes: created.notes,
    };
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
        email: body.email,
        phone: body.phone,
        notes: body.notes,
        actorUserId: requestContext.workspace.userId,
      }),
    );

    return {
      id: updated.id,
      name: updated.name,
      companyId: updated.companyId,
      companyName: updated.companyName,
      email: updated.email,
      phone: updated.phone,
      notes: updated.notes,
    };
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
