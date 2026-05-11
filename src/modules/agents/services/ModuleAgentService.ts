import { AppError } from "../../../core/errors/AppError.js";
import { ModuleAgentEntity } from "../domain/ModuleAgentEntity.js";
import { UpdateModuleAgentPromptCommand } from "../dto/UpdateModuleAgentPromptCommand.js";
import { ModuleAgentRepository } from "../repositories/ModuleAgentRepository.js";

export class ModuleAgentService {
  private readonly repository: ModuleAgentRepository;

  public constructor(repository: ModuleAgentRepository) {
    this.repository = repository;
  }

  public async listModuleAgents(workspaceId: string): Promise<ModuleAgentEntity[]> {
    return this.repository.listModuleAgents(workspaceId);
  }

  public async resolveActivePrompt(params: {
    workspaceId: string;
    moduleKey: string;
    agentKey: string;
  }): Promise<string | null> {
    return this.repository.resolveActivePrompt(params);
  }

  public async updateModuleAgentPrompt(command: UpdateModuleAgentPromptCommand): Promise<ModuleAgentEntity> {
    const normalizedPrompt = command.activePrompt.trim();
    if (normalizedPrompt.length === 0) {
      throw new AppError("Il prompt attivo non puo essere vuoto.", "MODULE_AGENT_PROMPT_EMPTY", 400);
    }

    const updated = await this.repository.updateModuleAgentPrompt({
      workspaceId: command.workspaceId,
      agentId: command.agentId,
      activePrompt: normalizedPrompt,
      updatedByUserId: command.updatedByUserId,
    });

    if (!updated) {
      throw new AppError("Agente non trovato.", "MODULE_AGENT_NOT_FOUND", 404);
    }

    return updated;
  }

  public async resetModuleAgentPrompt(workspaceId: string, agentId: string, updatedByUserId: string): Promise<ModuleAgentEntity> {
    const updated = await this.repository.resetModuleAgentPrompt(workspaceId, agentId, updatedByUserId);
    if (!updated) {
      throw new AppError("Agente non trovato.", "MODULE_AGENT_NOT_FOUND", 404);
    }

    return updated;
  }
}
