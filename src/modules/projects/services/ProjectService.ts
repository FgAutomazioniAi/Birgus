import { AppError } from "../../../core/errors/AppError.js";
import { ProjectEntity } from "../domain/ProjectEntity.js";
import { ProjectVersionEntity } from "../domain/ProjectVersionEntity.js";
import { CreateProjectCommand } from "../dto/CreateProjectCommand.js";
import { CreateProjectVersionCommand } from "../dto/CreateProjectVersionCommand.js";
import { DeleteProjectVersionCommand } from "../dto/DeleteProjectVersionCommand.js";
import { SelectDefaultVersionCommand } from "../dto/SelectDefaultVersionCommand.js";
import { ProjectRepository } from "../repositories/ProjectRepository.js";
import { CreateShipmentCommand } from "../../shipping/dto/CreateShipmentCommand.js";
import { ShipmentService } from "../../shipping/services/ShipmentService.js";
import { NotificationService } from "../../notifications/services/NotificationService.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { AuditLogService } from "../../audit/services/AuditLogService.js";

export class ProjectService {
  private readonly repository: ProjectRepository;
  private readonly shipmentService: ShipmentService | null;
  private readonly notificationService: NotificationService | null;
  private readonly auditLogService: AuditLogService | null;

  public constructor(
    repository: ProjectRepository,
    shipmentService?: ShipmentService | null,
    notificationService?: NotificationService | null,
    auditLogService?: AuditLogService | null,
  ) {
    this.repository = repository;
    this.shipmentService = shipmentService ?? null;
    this.notificationService = notificationService ?? null;
    this.auditLogService = auditLogService ?? null;
  }

  public async listProjects(workspaceId: string): Promise<ProjectEntity[]> {
    return this.repository.listProjects(workspaceId);
  }

  public async createProject(command: CreateProjectCommand): Promise<ProjectEntity> {
    if (!command.projectName || command.projectName.length < 2) {
      throw new AppError("Project name is too short.", "PROJECT_NAME_INVALID", 400);
    }

    const project = await this.repository.createProject({
      workspaceId: command.workspaceId,
      projectName: command.projectName,
      ownerUserId: command.ownerUserId,
      statusKey: command.statusKey,
      authorId: command.authorId,
      revisionId: command.revisionId,
      publisherName: command.publisherName,
      publicationDate: command.publicationDate,
      authorDate: command.authorDate,
    });

    await this.repository.linkProjectClient(command.workspaceId, project.id, command.clientId);

    let initialVersion: ProjectVersionEntity | null = null;
    try {
      initialVersion = await this.ensureInitialVersion(
        command.workspaceId,
        project.id,
        command.clientId,
        command.statusKey,
      );
    } catch (error) {
      await this.repository.softDeleteProject(command.workspaceId, project.id);
      throw error;
    }

    await this.notify(command.workspaceId, project.name, "Progetto creato.");
    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.actorUserId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project.create",
      entityType: "Project",
      entityId: project.id,
      payload: {
        name: project.name,
        clientId: command.clientId,
        authorId: command.authorId,
        revisionId: command.revisionId,
      },
    });

    return new ProjectEntity({
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      statusKey: project.statusKey,
      authorId: project.authorId,
      authorName: project.authorName,
      revisionId: project.revisionId,
      revisionCode: project.revisionCode,
      publisherName: project.publisherName,
      publicationDate: project.publicationDate,
      authorDate: project.authorDate,
      createdAt: project.createdAt,
      versionsCount: initialVersion ? 1 : 0,
    });
  }

  public async getProject(workspaceId: string, projectId: string): Promise<ProjectEntity> {
    const project = await this.repository.findProjectById(workspaceId, projectId);
    if (!project) {
      throw new AppError("Project not found.", "PROJECT_NOT_FOUND", 404);
    }

    return project;
  }

  public async updateProject(params: {
    workspaceId: string;
    projectId: string;
    projectName: string;
    statusKey: string;
    clientId: string;
    authorId: number | null;
    revisionId: number | null;
    publisherName: string;
    publicationDate: Date | null;
    authorDate: Date | null;
    actorUserId?: string | null;
  }): Promise<ProjectEntity> {
    const projectName = params.projectName.trim().replace(/\s+/g, " ");
    if (projectName.length < 2) {
      throw new AppError("Project name is too short.", "PROJECT_NAME_INVALID", 400);
    }

    const updated = await this.repository.updateProject({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      projectName,
      statusKey: params.statusKey,
      authorId: params.authorId,
      revisionId: params.revisionId,
      publisherName: params.publisherName,
      publicationDate: params.publicationDate,
      authorDate: params.authorDate,
    });

    if (!updated) {
      throw new AppError("Project not found.", "PROJECT_NOT_FOUND", 404);
    }

    await this.repository.setProjectPrimaryClient(params.workspaceId, params.projectId, params.clientId);
    await this.notify(params.workspaceId, updated.name, "Progetto aggiornato.");
    await this.auditLogService?.record({
      workspaceId: params.workspaceId,
      userId: params.actorUserId ?? null,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project.update",
      entityType: "Project",
      entityId: updated.id,
      payload: {
        name: updated.name,
        clientId: params.clientId,
        authorId: params.authorId,
        revisionId: params.revisionId,
      },
    });

    return new ProjectEntity({
      ...updated,
      clientId: params.clientId,
      authorId: params.authorId,
      revisionId: params.revisionId,
      publisherName: params.publisherName,
      publicationDate: params.publicationDate,
      authorDate: params.authorDate,
    });
  }

  public async deleteProject(workspaceId: string, projectId: string, actorUserId?: string | null): Promise<void> {
    const project = await this.repository.findProjectById(workspaceId, projectId);
    if (!project) {
      throw new AppError("Project not found.", "PROJECT_NOT_FOUND", 404);
    }

    const activeVersions = await this.repository.listVersions(workspaceId, projectId);
    const removed = await this.repository.softDeleteProject(workspaceId, projectId);
    if (!removed) {
      throw new AppError("Project not found.", "PROJECT_NOT_FOUND", 404);
    }

    await Promise.all(
      activeVersions.map((version) => this.shipmentService?.deleteShipmentForProjectVersion(workspaceId, version.id)),
    );
    await this.notify(workspaceId, project.name, "Progetto archiviato.");
    await this.auditLogService?.record({
      workspaceId,
      userId: actorUserId ?? null,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project.delete",
      entityType: "Project",
      entityId: projectId,
      payload: null,
    });
  }

  public async listProjectVersions(workspaceId: string, projectId: string): Promise<ProjectVersionEntity[]> {
    const project = await this.repository.findProjectById(workspaceId, projectId);
    if (!project) {
      throw new AppError("Project not found.", "PROJECT_NOT_FOUND", 404);
    }

    return this.repository.listVersions(workspaceId, projectId);
  }

  public async createProjectVersion(command: CreateProjectVersionCommand): Promise<ProjectVersionEntity> {
    const project = await this.repository.findProjectById(command.workspaceId, command.projectId);
    if (!project) {
      throw new AppError("Project not found.", "PROJECT_NOT_FOUND", 404);
    }

    const existingVersions = await this.repository.listVersions(command.workspaceId, command.projectId);
    const nextVersionLabel = this.computeNextVersionLabel(existingVersions.map((version) => version.versionLabel));

    await this.repository.clearDefaultVersionFlags(command.workspaceId, command.projectId);

    const version = await this.repository.createVersion({
      workspaceId: command.workspaceId,
      projectId: command.projectId,
      versionLabel: nextVersionLabel,
      description: this.normalizeDescription(command.description),
      statusKey: command.statusKey,
      clientId: command.clientId,
      isDefault: true,
    });

    try {
      await this.ensureShipmentForVersion(command.workspaceId, version.id, command.createdByUserId ?? null);
    } catch (error) {
      await this.repository.softDeleteVersion(version.id);
      const fallback = await this.repository.findMostRecentActiveVersion(command.workspaceId, command.projectId);
      if (fallback) {
        await this.repository.setDefaultVersion(fallback.id);
      }
      throw error;
    }

    const refreshedVersion = await this.repository.findVersionByLabel(
      command.workspaceId,
      command.projectId,
      version.versionLabel,
    );

    await this.notify(
      command.workspaceId,
      project.name,
      `Versione ${version.versionLabel.toUpperCase()} creata.`,
    );
    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.createdByUserId ?? null,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project_version.create",
      entityType: "ProjectVersion",
      entityId: null,
      payload: { projectId: command.projectId, versionId: version.id, versionLabel: version.versionLabel },
    });

    return refreshedVersion ?? version;
  }

  public async selectDefaultVersion(command: SelectDefaultVersionCommand): Promise<ProjectVersionEntity> {
    const target = await this.repository.findVersionByLabel(
      command.workspaceId,
      command.projectId,
      command.versionLabel,
    );

    if (!target) {
      throw new AppError("Version not found.", "PROJECT_VERSION_NOT_FOUND", 404);
    }

    await this.repository.clearDefaultVersionFlags(command.workspaceId, command.projectId);
    await this.repository.setDefaultVersion(target.id);
    const project = await this.repository.findProjectById(command.workspaceId, command.projectId);
    await this.notify(
      command.workspaceId,
      project?.name ?? "Progetti",
      `Versione ${target.versionLabel.toUpperCase()} impostata come predefinita.`,
    );
    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: null,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project_version.set_default",
      entityType: "Project",
      entityId: command.projectId,
      payload: { versionId: target.id, versionLabel: target.versionLabel },
    });

    return new ProjectVersionEntity({
      ...target,
      isDefault: true,
    });
  }

  public async deleteProjectVersion(command: DeleteProjectVersionCommand): Promise<void> {
    const target = await this.repository.findVersionByLabel(
      command.workspaceId,
      command.projectId,
      command.versionLabel,
    );

    if (!target) {
      throw new AppError("Version not found.", "PROJECT_VERSION_NOT_FOUND", 404);
    }

    const activeCount = await this.repository.countActiveVersions(command.workspaceId, command.projectId);
    if (activeCount <= 1) {
      throw new AppError("Cannot remove the last active version.", "PROJECT_LAST_VERSION", 400);
    }

    await this.repository.softDeleteVersion(target.id);
    await this.shipmentService?.deleteShipmentForProjectVersion(command.workspaceId, target.id);

    if (target.isDefault) {
      const fallback = await this.repository.findMostRecentActiveVersion(command.workspaceId, command.projectId);
      if (fallback) {
        await this.repository.setDefaultVersion(fallback.id);
      }
    }

    const project = await this.repository.findProjectById(command.workspaceId, command.projectId);
    await this.notify(
      command.workspaceId,
      project?.name ?? "Progetti",
      `Versione ${target.versionLabel.toUpperCase()} archiviata.`,
    );
    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: null,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project_version.delete",
      entityType: "ProjectVersion",
      entityId: null,
      payload: { projectId: command.projectId, versionId: target.id, versionLabel: target.versionLabel },
    });
  }

  private async ensureInitialVersion(
    workspaceId: string,
    projectId: string,
    clientId: string,
    statusKey: string,
  ): Promise<ProjectVersionEntity | null> {
    const versions = await this.repository.listVersions(workspaceId, projectId);
    if (versions.length > 0) {
      return null;
    }

    const version = await this.repository.createVersion({
      workspaceId,
      projectId,
      versionLabel: "v1",
      description: "Initial version",
      statusKey,
      clientId,
      isDefault: true,
    });

    await this.ensureShipmentForVersion(workspaceId, version.id, null);

    const refreshedVersion = await this.repository.findVersionByLabel(workspaceId, projectId, version.versionLabel);
    return refreshedVersion ?? version;
  }

  private normalizeDescription(description: string): string {
    const normalized = description.trim().replace(/\s+/g, " ");
    if (!normalized) {
      return "Initial version";
    }

    return normalized.slice(0, 200);
  }

  private computeNextVersionLabel(existing: string[]): string {
    const maxVersion = existing.reduce((max, item) => {
      const match = /^v(\d+)$/.exec(item.toLowerCase());
      if (!match) {
        return max;
      }

      const value = Number.parseInt(match[1] ?? "0", 10);
      if (!Number.isFinite(value)) {
        return max;
      }

      return Math.max(max, value);
    }, 0);

    return `v${Math.max(1, maxVersion + 1)}`;
  }

  private async ensureShipmentForVersion(
    workspaceId: string,
    projectVersionId: number,
    createdByUserId: string | null,
  ): Promise<void> {
    if (!this.shipmentService) {
      return;
    }

    await this.shipmentService.createShipment(
      new CreateShipmentCommand({
        workspaceId,
        projectVersionId,
        statusKey: "draft",
        createdByUserId,
      }),
    );
  }

  private async notify(workspaceId: string, title: string, message: string): Promise<void> {
    if (!this.notificationService) {
      return;
    }

    try {
      await this.notificationService.createInfo({
        workspaceId,
        userId: null,
        moduleKey: ModuleKey.PROJECT_MANAGEMENT,
        title,
        message,
      });
    } catch (error) {
      console.error("[ProjectService] Unable to create notification", { workspaceId, title, message, error });
    }
  }
}
