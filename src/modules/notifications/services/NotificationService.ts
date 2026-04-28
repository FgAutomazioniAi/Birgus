import { NotificationEntity } from "../domain/NotificationEntity.js";
import { NotificationRepository } from "../repositories/NotificationRepository.js";

export class NotificationService {
  private readonly repository: NotificationRepository;

  public constructor(repository: NotificationRepository) {
    this.repository = repository;
  }

  public async createInfo(params: {
    workspaceId: string;
    userId: string | null;
    moduleKey: string | null;
    title: string;
    message: string;
  }): Promise<NotificationEntity> {
    return this.repository.create({
      ...params,
      type: "info",
    });
  }

  public async listForUser(workspaceId: string, userId: string): Promise<NotificationEntity[]> {
    return this.repository.listForUser(workspaceId, userId);
  }

  public async markAllAsRead(workspaceId: string, userId: string): Promise<void> {
    await this.repository.markAllAsRead(workspaceId, userId);
  }

  public async clearForUser(workspaceId: string, userId: string): Promise<void> {
    await this.repository.clearForUser(workspaceId, userId);
  }
}
