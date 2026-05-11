import { ModuleAgentEntity } from "../domain/ModuleAgentEntity.js";

export interface ModuleAgentRepository {
  listModuleAgents(workspaceId: string): Promise<ModuleAgentEntity[]>;
  findModuleAgentById(workspaceId: string, agentId: string): Promise<ModuleAgentEntity | null>;
  resolveActivePrompt(params: {
    workspaceId: string;
    moduleKey: string;
    agentKey: string;
  }): Promise<string | null>;
  updateModuleAgentPrompt(params: {
    workspaceId: string;
    agentId: string;
    activePrompt: string;
    updatedByUserId: string;
  }): Promise<ModuleAgentEntity | null>;
  resetModuleAgentPrompt(workspaceId: string, agentId: string, updatedByUserId: string): Promise<ModuleAgentEntity | null>;
}
