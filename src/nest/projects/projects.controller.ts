import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { CreateProjectCommand } from "../../modules/projects/dto/CreateProjectCommand.js";
import { CreateProjectVersionCommand } from "../../modules/projects/dto/CreateProjectVersionCommand.js";
import { DeleteProjectVersionCommand } from "../../modules/projects/dto/DeleteProjectVersionCommand.js";
import { SelectDefaultVersionCommand } from "../../modules/projects/dto/SelectDefaultVersionCommand.js";
import { ProjectService } from "../../modules/projects/services/ProjectService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const createProjectSchema = z.object({
  projectName: z.string().min(2),
  statusKey: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  clientId: z.string().uuid(),
  authorId: z.number().int().positive().nullable().optional(),
  revisionId: z.number().int().positive().nullable().optional(),
  publisherName: z.string().trim().max(120).optional().default(""),
  publicationDate: z.coerce.date().nullable().optional(),
  authorDate: z.coerce.date().nullable().optional(),
});

const createVersionSchema = z.object({
  description: z.string().min(2).max(200),
  statusKey: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  clientId: z.string().uuid().nullable().optional(),
});

const setDefaultVersionSchema = z.object({
  versionLabel: z.string().min(1),
});

const updateProjectSchema = createProjectSchema;

const deleteVersionBodySchema = z.object({
  versionLabel: z.string().min(1),
  confirmText: z.string().min(1),
});

const deleteProjectBodySchema = z.object({
  confirmText: z.string().min(1),
});

@Controller("/api/projects")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.PROJECT_MANAGEMENT)
export class NestProjectsController {
  public constructor(
    @Inject(ProjectService)
    private readonly service: ProjectService,
  ) {}

  @Get()
  @RequirePermission(PermissionKey.PROJECTS_READ)
  public async listProjects(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const projects = await this.service.listProjects(workspaceId);

    return projects.map((item) => ({
      id: item.id,
      project: item.name,
      date: item.createdAt.toLocaleDateString("it-IT"),
      versionsCount: item.versionsCount,
      status: item.statusKey,
      statusKey: item.statusKey,
      projectName: item.name,
      clientId: item.clientId,
      authorId: item.authorId,
      authorName: item.authorName,
      revisionId: item.revisionId,
      revisionCode: item.revisionCode,
      publisherName: item.publisherName,
      publicationDate: item.publicationDate,
      authorDate: item.authorDate,
      createdAt: item.createdAt,
    }));
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async createProject(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = createProjectSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const statusKey = this.resolveStatusKey(body.statusKey, body.status);

    const created = await this.service.createProject(
      new CreateProjectCommand({
        workspaceId,
        projectName: body.projectName,
        statusKey,
        clientId: body.clientId,
        ownerUserId: userId,
        authorId: body.authorId ?? null,
        revisionId: body.revisionId ?? null,
        publisherName: body.publisherName,
        publicationDate: body.publicationDate ?? null,
        authorDate: body.authorDate ?? null,
        actorUserId: userId,
      }),
    );

    return {
      id: created.id,
      projectName: created.name,
      project: created.name,
      statusKey: created.statusKey,
      status: created.statusKey,
      clientId: body.clientId,
      authorId: created.authorId,
      authorName: created.authorName,
      revisionId: created.revisionId,
      revisionCode: created.revisionCode,
      publisherName: created.publisherName,
      publicationDate: created.publicationDate,
      authorDate: created.authorDate,
      versionsCount: created.versionsCount,
    };
  }

  @Get(":projectId")
  @RequirePermission(PermissionKey.PROJECTS_READ)
  public async getProject(
    @Param("projectId") projectIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const project = await this.service.getProject(workspaceId, this.getProjectId(projectIdRaw));

    return {
      id: project.id,
      projectName: project.name,
      status: project.statusKey,
      statusKey: project.statusKey,
      clientId: project.clientId,
      authorId: project.authorId,
      authorName: project.authorName,
      revisionId: project.revisionId,
      revisionCode: project.revisionCode,
      publisherName: project.publisherName,
      publicationDate: project.publicationDate,
      authorDate: project.authorDate,
    };
  }

  @Patch(":projectId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async updateProject(
    @Param("projectId") projectIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = updateProjectSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const statusKey = this.resolveStatusKey(body.statusKey, body.status);
    const updated = await this.service.updateProject({
      workspaceId,
      projectId,
      projectName: body.projectName,
      statusKey,
      clientId: body.clientId,
      authorId: body.authorId ?? null,
      revisionId: body.revisionId ?? null,
      publisherName: body.publisherName,
      publicationDate: body.publicationDate ?? null,
      authorDate: body.authorDate ?? null,
      actorUserId: requestContext.workspace.userId,
    });

    return {
      id: updated.id,
      projectName: updated.name,
      project: updated.name,
      status: updated.statusKey,
      statusKey: updated.statusKey,
      clientId: updated.clientId,
      authorId: updated.authorId,
      authorName: updated.authorName,
      revisionId: updated.revisionId,
      revisionCode: updated.revisionCode,
      publisherName: updated.publisherName,
      publicationDate: updated.publicationDate,
      authorDate: updated.authorDate,
    };
  }

  @Delete(":projectId")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async deleteProject(
    @Param("projectId") projectIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteProjectBodySchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const project = await this.service.getProject(workspaceId, projectId);
    if (body.confirmText.trim() !== project.name.trim()) {
      throw new AppError(
        "Conferma eliminazione non valida: inserisci esattamente il nome del progetto.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    await this.service.deleteProject(workspaceId, projectId, requestContext.workspace.userId);
    return { ok: true, id: projectId };
  }

  @Get(":projectId/versions")
  @RequirePermission(PermissionKey.PROJECTS_READ)
  public async listVersions(
    @Param("projectId") projectIdRaw: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    return this.buildVersionsPayload(workspaceId, projectId);
  }

  @Post(":projectId/versions")
  @HttpCode(201)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async createVersion(
    @Param("projectId") projectIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = createVersionSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const statusKey = this.resolveStatusKey(body.statusKey, body.status);

    await this.service.createProjectVersion(
      new CreateProjectVersionCommand({
        workspaceId,
        projectId,
        description: body.description,
        statusKey,
        clientId: body.clientId ?? null,
        createdByUserId: requestContext.workspace.userId,
      }),
    );

    return this.buildVersionsPayload(workspaceId, projectId);
  }

  @Patch(":projectId/versions")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async setDefaultVersionCompatibility(
    @Param("projectId") projectIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = setDefaultVersionSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);

    await this.service.selectDefaultVersion(
      new SelectDefaultVersionCommand({
        workspaceId,
        projectId,
        versionLabel: body.versionLabel,
      }),
    );

    return this.buildVersionsPayload(workspaceId, projectId);
  }

  @Delete(":projectId/versions")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async deleteVersionCompatibility(
    @Param("projectId") projectIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteVersionBodySchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    await this.service.deleteProjectVersion(
      new DeleteProjectVersionCommand({
        workspaceId,
        projectId,
        versionLabel: body.versionLabel,
      }),
    );

    return this.buildVersionsPayload(workspaceId, projectId);
  }

  @Patch(":projectId/versions/default")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async setDefaultVersion(
    @Param("projectId") projectIdRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = setDefaultVersionSchema.parse(bodyRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);

    await this.service.selectDefaultVersion(
      new SelectDefaultVersionCommand({
        workspaceId,
        projectId,
        versionLabel: body.versionLabel,
      }),
    );

    return this.buildVersionsPayload(workspaceId, projectId);
  }

  @Delete(":projectId/versions/:versionLabel")
  @HttpCode(200)
  @RequirePermission(PermissionKey.PROJECTS_WRITE)
  public async deleteVersion(
    @Param("projectId") projectIdRaw: string,
    @Param("versionLabel") versionLabelRaw: string,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = deleteProjectBodySchema.parse(bodyRaw);
    if (body.confirmText.trim() !== "cancella") {
      throw new AppError(
        "Conferma eliminazione non valida: digita 'cancella'.",
        "DELETE_CONFIRMATION_INVALID",
        400,
      );
    }

    const workspaceId = requestContext.workspace.workspaceId;
    const projectId = this.getProjectId(projectIdRaw);
    const versionLabel = this.getVersionLabel(versionLabelRaw);

    await this.service.deleteProjectVersion(
      new DeleteProjectVersionCommand({
        workspaceId,
        projectId,
        versionLabel,
      }),
    );

    return this.buildVersionsPayload(workspaceId, projectId);
  }

  private getProjectId(projectId: string): string {
    if (!projectId || !projectId.trim()) {
      throw new AppError("Project ID is required.", "PROJECT_ID_REQUIRED", 400);
    }

    return projectId.trim();
  }

  private getVersionLabel(versionLabel: string): string {
    if (!versionLabel || !versionLabel.trim()) {
      throw new AppError("Version label is required.", "PROJECT_VERSION_LABEL_REQUIRED", 400);
    }

    return versionLabel.trim();
  }

  private resolveStatusKey(statusKey?: string, status?: string): string {
    const resolved = statusKey?.trim() || status?.trim() || "";
    if (!resolved) {
      throw new AppError("Project status is required.", "PROJECT_STATUS_REQUIRED", 400);
    }

    return resolved;
  }

  private async buildVersionsPayload(workspaceId: string, projectId: string): Promise<Record<string, unknown>> {
    const versions = await this.service.listProjectVersions(workspaceId, projectId);
    return {
      versions: versions.map((item) => ({
        id: item.id,
        versionLabel: item.versionLabel,
        description: item.description,
        clientId: item.clientId,
        clientName: item.clientName,
        status: item.statusKey,
        statusKey: item.statusKey,
        shipmentId: item.shipmentId,
        shipmentCode: item.shipmentCode,
        shipmentStatusKey: item.shipmentStatusKey,
        isDefault: item.isDefault,
        createdAt: item.createdAt,
      })),
      selectedVersionLabel:
        versions.find((item) => item.isDefault)?.versionLabel ??
        versions[0]?.versionLabel ??
        "v1",
    };
  }
}
