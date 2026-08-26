import { AppError } from "../../../core/errors/AppError.js";
import { ModuleAccessPolicy } from "../../../core/module-access/ModuleAccessPolicy.js";

export type WorkflowRuntimeNodeResource = {
  nodeKey: string;
  agent?: { moduleKey: string; enabled: boolean; deleted: boolean } | null;
  tool?: { moduleKey: string; enabled: boolean; deleted: boolean } | null;
};

/** Enforces current module state at execution time, including queued/system runs. */
export class WorkflowRuntimeAccessPolicy {
  public constructor(private readonly moduleAccessPolicy: ModuleAccessPolicy) {}

  public async ensureRunAllowed(params: {
    workspaceId: string;
    requestedByUserId: string | null;
    workflowModuleKey: string;
    nodes: WorkflowRuntimeNodeResource[];
  }): Promise<void> {
    const moduleKeys = new Set<string>([params.workflowModuleKey]);

    for (const node of params.nodes) {
      this.ensureResourceEnabled(node.nodeKey, "agent", node.agent);
      this.ensureResourceEnabled(node.nodeKey, "tool", node.tool);
      if (node.agent) {
        moduleKeys.add(node.agent.moduleKey);
      }
      if (node.tool) {
        moduleKeys.add(node.tool.moduleKey);
      }
    }

    for (const moduleKey of moduleKeys) {
      if (params.requestedByUserId) {
        await this.moduleAccessPolicy.ensureEnabled(params.workspaceId, params.requestedByUserId, moduleKey);
      } else {
        await this.moduleAccessPolicy.ensureEnabledForWorkspace(params.workspaceId, moduleKey);
      }
    }
  }

  private ensureResourceEnabled(
    nodeKey: string,
    resourceType: "agent" | "tool",
    resource: { moduleKey: string; enabled: boolean; deleted: boolean } | null | undefined,
  ): void {
    if (!resource) {
      return;
    }
    if (!resource.enabled || resource.deleted) {
      throw new AppError(
        `Workflow node '${nodeKey}' references a disabled ${resourceType}.`,
        "WORKFLOW_NODE_RESOURCE_DISABLED",
        403,
      );
    }
  }
}
