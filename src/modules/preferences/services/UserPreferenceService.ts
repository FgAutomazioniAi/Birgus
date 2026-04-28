import { UserPreferenceEntity } from "../domain/UserPreferenceEntity.js";
import { UserPreferencePatch, UserPreferenceRepository } from "../repositories/UserPreferenceRepository.js";

export class UserPreferenceService {
  private readonly repository: UserPreferenceRepository;

  public constructor(repository: UserPreferenceRepository) {
    this.repository = repository;
  }

  public async getPreferences(userId: string, workspaceId: string): Promise<UserPreferenceEntity | null> {
    return this.repository.getByUserAndWorkspace(userId, workspaceId);
  }

  public async updatePreferences(
    userId: string,
    workspaceId: string,
    patch: UserPreferencePatch,
  ): Promise<UserPreferenceEntity> {
    return this.repository.upsertForUserAndWorkspace(userId, workspaceId, patch);
  }
}
