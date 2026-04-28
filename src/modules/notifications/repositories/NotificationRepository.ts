import { NotificationEntity } from "../domain/NotificationEntity.js";

export interface NotificationRepository {
  create(params: {
    workspaceId: string;
    userId: string | null;
    moduleKey: string | null;
    type: string;
    title: string;
    message: string;
  }): Promise<NotificationEntity>;
  listForUser(workspaceId: string, userId: string): Promise<NotificationEntity[]>;
  markAllAsRead(workspaceId: string, userId: string): Promise<void>;
  clearForUser(workspaceId: string, userId: string): Promise<void>;
}
