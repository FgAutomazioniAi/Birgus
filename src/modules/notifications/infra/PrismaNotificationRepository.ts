import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { NotificationEntity } from "../domain/NotificationEntity.js";
import { NotificationRepository } from "../repositories/NotificationRepository.js";

export class PrismaNotificationRepository implements NotificationRepository {
  public async create(params: {
    workspaceId: string;
    userId: string | null;
    moduleKey: string | null;
    type: string;
    title: string;
    message: string;
  }): Promise<NotificationEntity> {
    const prisma = PrismaClientManager.getClient();

    const moduleRecord = params.moduleKey
      ? await prisma.module.findFirst({ where: { key: params.moduleKey }, select: { id: true, key: true } })
      : null;

    const row = await prisma.notification.create({
      data: {
        workspace_id: params.workspaceId,
        user_id: params.userId,
        module_id: moduleRecord?.id,
        type: params.type,
        title: params.title,
        message: params.message,
      },
      include: {
        module: {
          select: {
            key: true,
          },
        },
      },
    });

    return new NotificationEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      moduleKey: row.module?.key ?? null,
      type: row.type,
      title: row.title,
      message: row.message,
      readAt: row.read_at,
      createdAt: row.created_at,
    });
  }

  public async listForUser(workspaceId: string, userId: string): Promise<NotificationEntity[]> {
    const prisma = PrismaClientManager.getClient();

    const rows = await prisma.notification.findMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
        OR: [{ user_id: null }, { user_id: userId }],
      },
      include: {
        module: {
          select: {
            key: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      take: 30,
    });

    return rows.map((row) => new NotificationEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id,
      moduleKey: row.module?.key ?? null,
      type: row.type,
      title: row.title,
      message: row.message,
      readAt: row.read_at,
      createdAt: row.created_at,
    }));
  }

  public async markAllAsRead(workspaceId: string, userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.notification.updateMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
        read_at: null,
        OR: [{ user_id: null }, { user_id: userId }],
      },
      data: {
        read_at: new Date(),
      },
    });
  }

  public async clearForUser(workspaceId: string, userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.notification.updateMany({
      where: {
        workspace_id: workspaceId,
        deleted_at: null,
        OR: [{ user_id: null }, { user_id: userId }],
      },
      data: {
        deleted_at: new Date(),
      },
    });
  }
}
