import { AppError } from "../../../core/errors/AppError.js";
import { ModuleToolEntity } from "../domain/ModuleToolEntity.js";
import { ModuleWorkflowEntity } from "../domain/ModuleWorkflowEntity.js";
import { ModuleWorkflowRunEntity } from "../domain/ModuleWorkflowRunEntity.js";
import { WorkflowRepository } from "../repositories/WorkflowRepository.js";
import { WorkflowRunDispatcher } from "./WorkflowRunDispatcher.js";

export class WorkflowService {
  private readonly repository: WorkflowRepository;
  private readonly runDispatcher: WorkflowRunDispatcher | null;

  public constructor(repository: WorkflowRepository, runDispatcher?: WorkflowRunDispatcher | null) {
    this.repository = repository;
    this.runDispatcher = runDispatcher ?? null;
  }

  public async listModuleTools(workspaceId: string, moduleKey?: string): Promise<ModuleToolEntity[]> {
    return this.repository.listModuleTools(workspaceId, moduleKey);
  }

  public async listWorkflows(workspaceId: string, moduleKey?: string): Promise<ModuleWorkflowEntity[]> {
    return this.repository.listWorkflows(workspaceId, moduleKey);
  }

  public async getWorkflow(workspaceId: string, workflowId: string): Promise<ModuleWorkflowEntity> {
    const workflow = await this.repository.findWorkflowById(workspaceId, workflowId);
    if (!workflow) {
      throw new AppError("Workflow not found.", "WORKFLOW_NOT_FOUND", 404);
    }
    return workflow;
  }

  public async findWorkflowByKey(workspaceId: string, moduleKey: string, workflowKey: string): Promise<ModuleWorkflowEntity | null> {
    return this.repository.findWorkflowByKey(workspaceId, moduleKey, workflowKey);
  }

  public async saveWorkflowDefinition(input: Parameters<WorkflowRepository["saveWorkflowDefinition"]>[0]): Promise<ModuleWorkflowEntity> {
    if (!input.key.trim()) {
      throw new AppError("Workflow key is required.", "WORKFLOW_KEY_REQUIRED", 400);
    }
    if (!input.label.trim()) {
      throw new AppError("Workflow label is required.", "WORKFLOW_LABEL_REQUIRED", 400);
    }
    if (input.nodes.length === 0) {
      throw new AppError("Workflow must contain at least one node.", "WORKFLOW_NODES_REQUIRED", 400);
    }
    return this.repository.saveWorkflowDefinition(input);
  }

  public async listWorkflowRuns(workspaceId: string, workflowId?: string): Promise<ModuleWorkflowRunEntity[]> {
    return this.repository.listWorkflowRuns(workspaceId, workflowId);
  }

  public async getWorkflowRun(workspaceId: string, runId: string): Promise<ModuleWorkflowRunEntity> {
    const run = await this.repository.findWorkflowRunById(workspaceId, runId);
    if (!run) {
      throw new AppError("Workflow run not found.", "WORKFLOW_RUN_NOT_FOUND", 404);
    }
    return run;
  }

  public async createWorkflowRun(input: Parameters<WorkflowRepository["createWorkflowRun"]>[0]): Promise<ModuleWorkflowRunEntity> {
    const run = await this.repository.createWorkflowRun(input);
    if (this.runDispatcher) {
      try {
        await this.runDispatcher.dispatch(run.id);
      } catch (error) {
        console.error("[WorkflowService] Unable to dispatch workflow run", {
          runId: run.id,
          error,
        });
      }
    }
    return run;
  }

  public async deletePersonalWorkflow(workspaceId: string, workflowId: string, actorUserId: string): Promise<void> {
    const workflow = await this.getWorkflow(workspaceId, workflowId);
    if (workflow.moduleKey !== "workflow_management") {
      throw new AppError("Solo i workflow del Playground possono essere eliminati.", "WORKFLOW_DELETE_NOT_ALLOWED", 403);
    }
    await this.repository.deletePersonalWorkflow(workspaceId, workflowId, actorUserId);
  }
}
