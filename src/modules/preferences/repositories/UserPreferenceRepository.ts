import { UserPreferenceEntity } from "../domain/UserPreferenceEntity.js";

export interface UserPreferencePatch {
  paletteId?: string;
  notificationPosition?: string;
  notificationPopups?: boolean;
  languageCode?: string;
  rowsProjects?: number;
  rowsClients?: number;
  columnsProjects?: unknown | null;
  columnsClients?: unknown | null;
}

export interface UserPreferenceRepository {
  getByUserAndWorkspace(userId: string, workspaceId: string): Promise<UserPreferenceEntity | null>;
  upsertForUserAndWorkspace(userId: string, workspaceId: string, patch: UserPreferencePatch): Promise<UserPreferenceEntity>;
}
