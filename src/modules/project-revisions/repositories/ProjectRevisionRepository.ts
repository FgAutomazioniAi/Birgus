import { ProjectRevisionEntity } from "../domain/ProjectRevisionEntity.js";

export interface ProjectRevisionRepository {
  list(workspaceId: string): Promise<ProjectRevisionEntity[]>;
  findById(workspaceId: string, revisionId: number): Promise<ProjectRevisionEntity | null>;
  create(params: { workspaceId: string; code: string }): Promise<ProjectRevisionEntity>;
  update(params: { workspaceId: string; revisionId: number; code: string }): Promise<ProjectRevisionEntity | null>;
  delete(workspaceId: string, revisionId: number): Promise<boolean>;
}
