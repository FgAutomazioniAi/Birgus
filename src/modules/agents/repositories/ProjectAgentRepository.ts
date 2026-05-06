import { ProjectAgentEntity } from "../domain/ProjectAgentEntity.js";

export interface ProjectAgentRepository {
  listProjectAgents(workspaceId: string): Promise<ProjectAgentEntity[]>;
  findProjectAgentById(workspaceId: string, agentId: string): Promise<ProjectAgentEntity | null>;
  resolveActivePrompt(params: {
    workspaceId: string;
    moduleKey: string;
    agentKey: string;
    projectId?: string | null;
  }): Promise<string | null>;
  updateProjectAgentPrompt(params: {
    workspaceId: string;
    agentId: string;
    activePrompt: string;
    updatedByUserId: string;
  }): Promise<ProjectAgentEntity | null>;
  resetProjectAgentPrompt(workspaceId: string, agentId: string, updatedByUserId: string): Promise<ProjectAgentEntity | null>;
}
