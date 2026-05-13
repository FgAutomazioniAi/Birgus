import { ProjectEntity } from "../domain/ProjectEntity.js";
import { ProjectVersionEntity } from "../domain/ProjectVersionEntity.js";

export interface ProjectRepository {
  listProjects(workspaceId: string): Promise<ProjectEntity[]>;
  findProjectById(workspaceId: string, projectId: string): Promise<ProjectEntity | null>;
  updateProject(params: {
    workspaceId: string;
    projectId: string;
    projectName: string;
    statusKey: string;
    authorId: number | null;
    revisionId: number | null;
    publisherName: string;
    publicationDate: Date | null;
    authorDate: Date | null;
  }): Promise<ProjectEntity | null>;
  setProjectPrimaryClient(workspaceId: string, projectId: string, clientId: string): Promise<void>;
  softDeleteProject(workspaceId: string, projectId: string): Promise<boolean>;
  createProject(params: {
    workspaceId: string;
    projectName: string;
    ownerUserId: string;
    statusKey: string;
    authorId: number | null;
    revisionId: number | null;
    publisherName: string;
    publicationDate: Date | null;
    authorDate: Date | null;
  }): Promise<ProjectEntity>;
  linkProjectClient(workspaceId: string, projectId: string, clientId: string): Promise<void>;

  listVersions(workspaceId: string, projectId: string): Promise<ProjectVersionEntity[]>;
  findVersionByLabel(workspaceId: string, projectId: string, versionLabel: string): Promise<ProjectVersionEntity | null>;
  countActiveVersions(workspaceId: string, projectId: string): Promise<number>;
  createVersion(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    description: string;
    statusKey: string;
    clientId: string | null;
    isDefault: boolean;
  }): Promise<ProjectVersionEntity>;
  clearDefaultVersionFlags(workspaceId: string, projectId: string): Promise<void>;
  setDefaultVersion(versionId: number): Promise<void>;
  softDeleteVersion(versionId: number): Promise<void>;
  findMostRecentActiveVersion(workspaceId: string, projectId: string): Promise<ProjectVersionEntity | null>;
}
