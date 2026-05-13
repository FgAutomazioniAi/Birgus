import { ProjectAuthorEntity } from "../../projects/domain/ProjectAuthorEntity.js";

export interface ProjectAuthorRepository {
  list(workspaceId: string): Promise<ProjectAuthorEntity[]>;
  findById(workspaceId: string, authorId: number): Promise<ProjectAuthorEntity | null>;
  create(params: {
    workspaceId: string;
    firstName: string;
    lastName: string;
    displayName: string;
    notes: string;
  }): Promise<ProjectAuthorEntity>;
  update(params: {
    workspaceId: string;
    authorId: number;
    firstName: string;
    lastName: string;
    displayName: string;
    notes: string;
  }): Promise<ProjectAuthorEntity | null>;
  softDelete(workspaceId: string, authorId: number): Promise<boolean>;
}
