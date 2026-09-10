import { Inject, Injectable } from "@nestjs/common";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaService } from "../../../nest/prisma/prisma.service.js";
import { BrainywareClient } from "./BrainywareClient.js";

@Injectable()
export class BrainyWorkspaceDatabaseConnectionService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(BrainywareClient) private readonly client: BrainywareClient) {}

  public async list(workspaceId: string) {
    const rows = await this.prisma.brainyWorkspaceDatabaseConnection.findMany({ where: { workspace_id: workspaceId, deleted_at: null }, orderBy: { label: "asc" } });
    return rows.map((row) => ({ id: row.id, brainywareConnectionId: row.brainyware_connection_id, label: row.label }));
  }

  public async listAvailable() {
    const rows = await this.client.listDatabaseConnections();
    return rows.filter((row) => row.accessMode?.toUpperCase() === "READ_ONLY").map((row) => ({ id: row.id, label: row.name, dbType: row.dbType }));
  }

  public async enable(workspaceId: string, userId: string, brainywareConnectionId: string) {
    const id = brainywareConnectionId.trim();
    const connection = (await this.client.listDatabaseConnections()).find((row) => row.id === id);
    if (!connection) throw new AppError("La connessione Brainyware non e' accessibile al service account.", "BRAINY_DATABASE_NOT_FOUND", 404);
    if (connection.accessMode?.toUpperCase() !== "READ_ONLY") throw new AppError("Birgus consente esclusivamente connessioni Brainyware READ_ONLY.", "BRAINY_DATABASE_READ_ONLY_REQUIRED", 409);
    const row = await this.prisma.brainyWorkspaceDatabaseConnection.upsert({
      where: { workspace_id_brainyware_connection_id: { workspace_id: workspaceId, brainyware_connection_id: id } },
      create: { workspace_id: workspaceId, brainyware_connection_id: id, label: connection.name, created_by_user_id: userId },
      update: { label: connection.name, deleted_at: null },
    });
    return { id: row.id, brainywareConnectionId: row.brainyware_connection_id, label: row.label };
  }

  public async archive(workspaceId: string, id: string) {
    const result = await this.prisma.brainyWorkspaceDatabaseConnection.updateMany({ where: { id, workspace_id: workspaceId, deleted_at: null }, data: { deleted_at: new Date() } });
    if (!result.count) throw new AppError("Connessione database Brainy non trovata.", "BRAINY_DATABASE_NOT_FOUND", 404);
  }
}
