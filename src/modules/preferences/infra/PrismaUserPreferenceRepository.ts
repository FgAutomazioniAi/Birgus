import { Prisma } from "@prisma/client";

import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { UserPreferenceEntity } from "../domain/UserPreferenceEntity.js";
import { UserPreferencePatch, UserPreferenceRepository } from "../repositories/UserPreferenceRepository.js";

export class PrismaUserPreferenceRepository implements UserPreferenceRepository {
  public async getByUserAndWorkspace(userId: string, workspaceId: string): Promise<UserPreferenceEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.userPreference.findFirst({
      where: {
        user_id: userId,
        workspace_id: workspaceId,
      },
    });

    return row ? this.mapRow(row) : null;
  }

  public async upsertForUserAndWorkspace(
    userId: string,
    workspaceId: string,
    patch: UserPreferencePatch,
  ): Promise<UserPreferenceEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.userPreference.upsert({
      where: {
        user_id_workspace_id: {
          user_id: userId,
          workspace_id: workspaceId,
        },
      },
      update: {
        palette_id: patch.paletteId,
        notification_position: patch.notificationPosition,
        notification_popups: patch.notificationPopups,
        language_code: patch.languageCode,
        rows_projects: patch.rowsProjects,
        rows_clients: patch.rowsClients,
        rows_shipments: patch.rowsShipments,
        columns_projects: this.toInputJsonValueOrUndefined(patch.columnsProjects),
        columns_clients: this.toInputJsonValueOrUndefined(patch.columnsClients),
        columns_shipments: this.toInputJsonValueOrUndefined(patch.columnsShipments),
      },
      create: {
        user_id: userId,
        workspace_id: workspaceId,
        palette_id: patch.paletteId ?? "predefinito",
        notification_position: patch.notificationPosition ?? "bottom-right",
        notification_popups: patch.notificationPopups ?? true,
        language_code: patch.languageCode ?? "it",
        rows_projects: patch.rowsProjects ?? 10,
        rows_clients: patch.rowsClients ?? 10,
        rows_shipments: patch.rowsShipments ?? 10,
        columns_projects: this.toInputJsonValueOrUndefined(patch.columnsProjects),
        columns_clients: this.toInputJsonValueOrUndefined(patch.columnsClients),
        columns_shipments: this.toInputJsonValueOrUndefined(patch.columnsShipments),
      },
    });

    return this.mapRow(row);
  }

  private mapRow(row: {
    user_id: string;
    workspace_id: string | null;
    palette_id: string;
    notification_position: string;
    notification_popups: boolean;
    language_code: string;
    rows_projects: number;
    rows_clients: number;
    rows_shipments: number;
    columns_projects: Prisma.JsonValue | null;
    columns_clients: Prisma.JsonValue | null;
    columns_shipments: Prisma.JsonValue | null;
  }): UserPreferenceEntity {
    return new UserPreferenceEntity({
      userId: row.user_id,
      workspaceId: row.workspace_id,
      paletteId: row.palette_id,
      notificationPosition: row.notification_position,
      notificationPopups: row.notification_popups,
      languageCode: row.language_code,
      rowsProjects: row.rows_projects,
      rowsClients: row.rows_clients,
      rowsShipments: row.rows_shipments,
      columnsProjects: row.columns_projects,
      columnsClients: row.columns_clients,
      columnsShipments: row.columns_shipments,
    });
  }

  private toInputJsonValueOrUndefined(
    value: unknown | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }
}
