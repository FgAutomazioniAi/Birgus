import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { AuditLogService } from "../../audit/services/AuditLogService.js";
import { ProjectRevisionEntity } from "../domain/ProjectRevisionEntity.js";
import { CreateProjectRevisionCommand } from "../dto/CreateProjectRevisionCommand.js";
import { UpdateProjectRevisionCommand } from "../dto/UpdateProjectRevisionCommand.js";
import { ProjectRevisionRepository } from "../repositories/ProjectRevisionRepository.js";

export class ProjectRevisionService {
  private readonly repository: ProjectRevisionRepository;
  private readonly auditLogService: AuditLogService | null;

  public constructor(repository: ProjectRevisionRepository, auditLogService?: AuditLogService | null) {
    this.repository = repository;
    this.auditLogService = auditLogService ?? null;
  }

  public async list(workspaceId: string): Promise<ProjectRevisionEntity[]> {
    return this.repository.list(workspaceId);
  }

  public async getById(workspaceId: string, revisionId: number): Promise<ProjectRevisionEntity> {
    const item = await this.repository.findById(workspaceId, revisionId);
    if (!item) {
      throw new AppError("Project revision not found.", "PROJECT_REVISION_NOT_FOUND", 404);
    }

    return item;
  }

  public async create(command: CreateProjectRevisionCommand): Promise<ProjectRevisionEntity> {
    const code = this.normalizeCode(command.code);
    const revision = await this.repository.create({ workspaceId: command.workspaceId, code });

    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.actorUserId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project_revision.create",
      entityType: "ProjectRevision",
      entityId: null,
      payload: { revisionId: revision.id, code: revision.code },
    });

    return revision;
  }

  public async update(command: UpdateProjectRevisionCommand): Promise<ProjectRevisionEntity> {
    const revision = await this.repository.update({
      workspaceId: command.workspaceId,
      revisionId: command.revisionId,
      code: this.normalizeCode(command.code),
    });

    if (!revision) {
      throw new AppError("Project revision not found.", "PROJECT_REVISION_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.actorUserId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project_revision.update",
      entityType: "ProjectRevision",
      entityId: null,
      payload: { revisionId: revision.id, code: revision.code },
    });

    return revision;
  }

  public async delete(workspaceId: string, revisionId: number, actorUserId?: string | null): Promise<void> {
    const removed = await this.repository.delete(workspaceId, revisionId);
    if (!removed) {
      throw new AppError("Project revision not found.", "PROJECT_REVISION_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId,
      userId: actorUserId ?? null,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project_revision.delete",
      entityType: "ProjectRevision",
      entityId: null,
      payload: { revisionId },
    });
  }

  private normalizeCode(code: string): string {
    const normalized = code.trim().replace(/\s+/g, " ");
    if (!normalized) {
      throw new AppError("Revision code is required.", "PROJECT_REVISION_CODE_INVALID", 400);
    }

    return normalized.slice(0, 80);
  }
}
