import { UserPreferenceEntity } from "../domain/UserPreferenceEntity.js";

export interface UserPreferencePatch {
  paletteId?: string;
  notificationPosition?: string;
  languageCode?: string;
  rowsProjects?: number;
  rowsClients?: number;
  rowsShipments?: number;
  columnsProjects?: unknown | null;
  columnsClients?: unknown | null;
  columnsShipments?: unknown | null;
}

export interface UserPreferenceRepository {
  getByUserAndWorkspace(userId: string, workspaceId: string): Promise<UserPreferenceEntity | null>;
  upsertForUserAndWorkspace(userId: string, workspaceId: string, patch: UserPreferencePatch): Promise<UserPreferenceEntity>;
}
