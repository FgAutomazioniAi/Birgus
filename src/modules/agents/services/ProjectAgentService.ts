import { AppError } from "../../../core/errors/AppError.js";
import { ProjectAgentEntity } from "../domain/ProjectAgentEntity.js";
import { UpdateProjectAgentPromptCommand } from "../dto/UpdateProjectAgentPromptCommand.js";
import { ProjectAgentRepository } from "../repositories/ProjectAgentRepository.js";

export class ProjectAgentService {
  private readonly repository: ProjectAgentRepository;

  public constructor(repository: ProjectAgentRepository) {
    this.repository = repository;
  }

  public async listProjectAgents(workspaceId: string): Promise<ProjectAgentEntity[]> {
    return this.repository.listProjectAgents(workspaceId);
  }

  public async resolveActivePrompt(params: {
    workspaceId: string;
    moduleKey: string;
    agentKey: string;
    projectId?: string | null;
  }): Promise<string | null> {
    return this.repository.resolveActivePrompt(params);
  }

  public async updateProjectAgentPrompt(command: UpdateProjectAgentPromptCommand): Promise<ProjectAgentEntity> {
    const normalizedPrompt = command.activePrompt.trim();
    if (normalizedPrompt.length === 0) {
      throw new AppError("Il prompt attivo non puo essere vuoto.", "PROJECT_AGENT_PROMPT_EMPTY", 400);
    }

    const updated = await this.repository.updateProjectAgentPrompt({
      workspaceId: command.workspaceId,
      agentId: command.agentId,
      activePrompt: normalizedPrompt,
      updatedByUserId: command.updatedByUserId,
    });

    if (!updated) {
      throw new AppError("Agente non trovato.", "PROJECT_AGENT_NOT_FOUND", 404);
    }

    return updated;
  }

  public async resetProjectAgentPrompt(workspaceId: string, agentId: string, updatedByUserId: string): Promise<ProjectAgentEntity> {
    const updated = await this.repository.resetProjectAgentPrompt(workspaceId, agentId, updatedByUserId);
    if (!updated) {
      throw new AppError("Agente non trovato.", "PROJECT_AGENT_NOT_FOUND", 404);
    }

    return updated;
  }
}
