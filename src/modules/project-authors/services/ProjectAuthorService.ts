import { AppError } from "../../../core/errors/AppError.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { AuditLogService } from "../../audit/services/AuditLogService.js";
import { ProjectAuthorEntity } from "../../projects/domain/ProjectAuthorEntity.js";
import { CreateProjectAuthorCommand } from "../dto/CreateProjectAuthorCommand.js";
import { UpdateProjectAuthorCommand } from "../dto/UpdateProjectAuthorCommand.js";
import { ProjectAuthorRepository } from "../repositories/ProjectAuthorRepository.js";

export class ProjectAuthorService {
  private readonly repository: ProjectAuthorRepository;
  private readonly auditLogService: AuditLogService | null;

  public constructor(repository: ProjectAuthorRepository, auditLogService?: AuditLogService | null) {
    this.repository = repository;
    this.auditLogService = auditLogService ?? null;
  }

  public async list(workspaceId: string): Promise<ProjectAuthorEntity[]> {
    return this.repository.list(workspaceId);
  }

  public async getById(workspaceId: string, authorId: number): Promise<ProjectAuthorEntity> {
    const item = await this.repository.findById(workspaceId, authorId);
    if (!item) {
      throw new AppError("Project author not found.", "PROJECT_AUTHOR_NOT_FOUND", 404);
    }

    return item;
  }

  public async create(command: CreateProjectAuthorCommand): Promise<ProjectAuthorEntity> {
    const firstName = this.normalizeRequiredName(command.firstName, "PROJECT_AUTHOR_NAME_INVALID");
    const lastName = this.normalizeOptionalValue(command.lastName);
    const displayName = this.resolveDisplayName(firstName, lastName, command.displayName);
    const author = await this.repository.create({
      workspaceId: command.workspaceId,
      firstName,
      lastName,
      displayName,
      notes: this.normalizeOptionalValue(command.notes),
    });

    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.actorUserId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project_author.create",
      entityType: "ProjectAuthor",
      entityId: null,
      payload: { authorId: author.id, displayName: author.displayName },
    });

    return author;
  }

  public async update(command: UpdateProjectAuthorCommand): Promise<ProjectAuthorEntity> {
    const firstName = this.normalizeRequiredName(command.firstName, "PROJECT_AUTHOR_NAME_INVALID");
    const lastName = this.normalizeOptionalValue(command.lastName);
    const displayName = this.resolveDisplayName(firstName, lastName, command.displayName);
    const author = await this.repository.update({
      workspaceId: command.workspaceId,
      authorId: command.authorId,
      firstName,
      lastName,
      displayName,
      notes: this.normalizeOptionalValue(command.notes),
    });

    if (!author) {
      throw new AppError("Project author not found.", "PROJECT_AUTHOR_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId: command.workspaceId,
      userId: command.actorUserId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project_author.update",
      entityType: "ProjectAuthor",
      entityId: null,
      payload: { authorId: author.id, displayName: author.displayName },
    });

    return author;
  }

  public async delete(workspaceId: string, authorId: number, actorUserId?: string | null): Promise<void> {
    const removed = await this.repository.softDelete(workspaceId, authorId);
    if (!removed) {
      throw new AppError("Project author not found.", "PROJECT_AUTHOR_NOT_FOUND", 404);
    }

    await this.auditLogService?.record({
      workspaceId,
      userId: actorUserId ?? null,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      action: "project_author.delete",
      entityType: "ProjectAuthor",
      entityId: null,
      payload: { authorId },
    });
  }

  private normalizeRequiredName(value: string, code: string): string {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized.length < 2) {
      throw new AppError("Author first name is too short.", code, 400);
    }

    return normalized;
  }

  private normalizeOptionalValue(value: string): string {
    return value.trim().replace(/\s+/g, " ");
  }

  private resolveDisplayName(firstName: string, lastName: string, explicitDisplayName: string): string {
    const normalized = explicitDisplayName.trim().replace(/\s+/g, " ");
    if (normalized) {
      return normalized;
    }

    return [firstName, lastName].join(" ").trim();
  }
}
