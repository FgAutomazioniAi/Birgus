import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";
import { CreateProjectCommand } from "../../modules/projects/dto/CreateProjectCommand.js";
import { CreateProjectVersionCommand } from "../../modules/projects/dto/CreateProjectVersionCommand.js";
import { DeleteProjectVersionCommand } from "../../modules/projects/dto/DeleteProjectVersionCommand.js";
import { SelectDefaultVersionCommand } from "../../modules/projects/dto/SelectDefaultVersionCommand.js";
import { ProjectService } from "../../modules/projects/services/ProjectService.js";

const createProjectSchema = z.object({
  projectName: z.string().min(2),
  statusKey: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  clientId: z.string().uuid(),
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

const updateProjectSchema = z.object({
  projectName: z.string().min(2),
  statusKey: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  clientId: z.string().uuid(),
});

const deleteVersionBodySchema = z.object({
  versionLabel: z.string().min(1),
});

export class ProjectController {
  private readonly service: ProjectService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(service: ProjectService, moduleGuard: ModuleGuard, permissionGuard: PermissionGuard) {
    this.service = service;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public listProjects = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projects = await this.service.listProjects(workspaceId);

      reply.code(200).send(
        projects.map((item) => ({
          id: item.id,
          project: item.name,
          date: item.createdAt.toLocaleDateString("it-IT"),
          versionsCount: item.versionsCount,
          status: item.statusKey,
          statusKey: item.statusKey,
          projectName: item.name,
          clientId: item.clientId,
          createdAt: item.createdAt,
        })),
      );
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public createProject = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);

      const body = createProjectSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const statusKey = this.resolveStatusKey(body.statusKey, body.status);

      const created = await this.service.createProject(
        new CreateProjectCommand({
          workspaceId,
          projectName: body.projectName,
          statusKey,
          clientId: body.clientId,
          ownerUserId: userId,
        }),
      );

      reply.code(201).send({
        id: created.id,
        projectName: created.name,
        project: created.name,
        statusKey: created.statusKey,
        status: created.statusKey,
        clientId: body.clientId,
        versionsCount: created.versionsCount,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getProject = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const project = await this.service.getProject(workspaceId, projectId);

      reply.code(200).send({
        id: project.id,
        projectName: project.name,
        status: project.statusKey,
        statusKey: project.statusKey,
        clientId: project.clientId,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public updateProject = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);

      const body = updateProjectSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const statusKey = this.resolveStatusKey(body.statusKey, body.status);
      const updated = await this.service.updateProject({
        workspaceId,
        projectId,
        projectName: body.projectName,
        statusKey,
        clientId: body.clientId,
      });

      reply.code(200).send({
        id: updated.id,
        projectName: updated.name,
        project: updated.name,
        status: updated.statusKey,
        statusKey: updated.statusKey,
        clientId: updated.clientId,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public deleteProject = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      await this.service.deleteProject(workspaceId, projectId);

      reply.code(200).send({ ok: true, id: projectId });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listVersions = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_READ);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const versions = await this.service.listProjectVersions(workspaceId, projectId);

      reply.code(200).send({
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
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public createVersion = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);

      const body = createVersionSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const userId = request.requestContext.workspace.userId;
      const statusKey = this.resolveStatusKey(body.statusKey, body.status);

      await this.service.createProjectVersion(
        new CreateProjectVersionCommand({
          workspaceId,
          projectId,
          description: body.description,
          statusKey,
          clientId: body.clientId ?? null,
          createdByUserId: userId,
        }),
      );

      await this.sendVersionsPayload(reply, workspaceId, projectId, 201);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public setDefaultVersion = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);

      const body = setDefaultVersionSchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);

      await this.service.selectDefaultVersion(
        new SelectDefaultVersionCommand({
          workspaceId,
          projectId,
          versionLabel: body.versionLabel,
        }),
      );

      await this.sendVersionsPayload(reply, workspaceId, projectId, 200);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public deleteVersion = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);
      const versionLabel = this.getVersionLabel(request);

      await this.service.deleteProjectVersion(
        new DeleteProjectVersionCommand({
          workspaceId,
          projectId,
          versionLabel,
        }),
      );

      await this.sendVersionsPayload(reply, workspaceId, projectId, 200);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public setDefaultVersionCompatibility = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    await this.setDefaultVersion(request, reply);
  };

  public deleteVersionCompatibility = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.moduleGuard.requireModule(request.requestContext, ModuleKey.PROJECT_MANAGEMENT);
      await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.PROJECTS_WRITE);

      const body = deleteVersionBodySchema.parse(request.body);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const projectId = this.getProjectId(request);

      await this.service.deleteProjectVersion(
        new DeleteProjectVersionCommand({
          workspaceId,
          projectId,
          versionLabel: body.versionLabel,
        }),
      );

      await this.sendVersionsPayload(reply, workspaceId, projectId, 200);
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getProjectId(request: AuthenticatedRequest): string {
    const projectId = (request.params as { projectId?: string }).projectId;
    if (!projectId || !projectId.trim()) {
      throw new AppError("Project ID is required.", "PROJECT_ID_REQUIRED", 400);
    }

    return projectId;
  }

  private getVersionLabel(request: AuthenticatedRequest): string {
    const versionLabel = (request.params as { versionLabel?: string }).versionLabel;
    if (!versionLabel || !versionLabel.trim()) {
      throw new AppError("Version label is required.", "PROJECT_VERSION_LABEL_REQUIRED", 400);
    }

    return versionLabel;
  }

  private resolveStatusKey(statusKey?: string, status?: string): string {
    const resolved = statusKey?.trim() || status?.trim() || "";
    if (!resolved) {
      throw new AppError("Project status is required.", "PROJECT_STATUS_REQUIRED", 400);
    }

    return resolved;
  }

  private async sendVersionsPayload(
    reply: FastifyReply,
    workspaceId: string,
    projectId: string,
    statusCode: number,
  ): Promise<void> {
    const versions = await this.service.listProjectVersions(workspaceId, projectId);
    reply.code(statusCode).send({
      versions: versions.map((item) => ({
        versionLabel: item.versionLabel,
        description: item.description,
        clientId: item.clientId,
        clientName: item.clientName,
        status: item.statusKey,
        statusKey: item.statusKey,
        isDefault: item.isDefault,
        createdAt: item.createdAt,
      })),
      selectedVersionLabel:
        versions.find((item) => item.isDefault)?.versionLabel ??
        versions[0]?.versionLabel ??
        "v1",
    });
  }

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof z.ZodError) {
      reply.code(400).send({ code: "VALIDATION_ERROR", message: "Invalid payload.", issues: error.issues });
      return;
    }

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code, message: error.message });
      return;
    }

    reply.code(500).send({ code: "INTERNAL_ERROR", message: "Unexpected error." });
  }
}
