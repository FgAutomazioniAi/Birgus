export class UpdateModuleAgentPromptCommand {
  public readonly workspaceId: string;
  public readonly agentId: string;
  public readonly activePrompt: string;
  public readonly updatedByUserId: string;

  public constructor(params: {
    workspaceId: string;
    agentId: string;
    activePrompt: string;
    updatedByUserId: string;
  }) {
    this.workspaceId = params.workspaceId;
    this.agentId = params.agentId;
    this.activePrompt = params.activePrompt;
    this.updatedByUserId = params.updatedByUserId;
  }
}
