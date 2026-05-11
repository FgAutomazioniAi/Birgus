import { PermissionPolicy } from "../../../core/authorization/PermissionPolicy.js";
import { ModuleAccessPolicy } from "../../../core/module-access/ModuleAccessPolicy.js";
import { AssistantToolDefinition, AssistantToolExecutionContext } from "../tools/AssistantToolDefinition.js";

export class AssistantToolAccessService {
  private readonly moduleAccessPolicy: ModuleAccessPolicy;
  private readonly permissionPolicy: PermissionPolicy;

  public constructor(moduleAccessPolicy: ModuleAccessPolicy, permissionPolicy: PermissionPolicy) {
    this.moduleAccessPolicy = moduleAccessPolicy;
    this.permissionPolicy = permissionPolicy;
  }

  public async ensureAllowed(context: AssistantToolExecutionContext, tool: AssistantToolDefinition): Promise<Record<string, unknown>> {
    for (const moduleKey of tool.moduleKeys) {
      await this.moduleAccessPolicy.ensureEnabled(context.workspaceId, context.userId, moduleKey);
    }

    for (const permissionKey of tool.permissionKeys) {
      await this.permissionPolicy.ensureAllowed(context.workspaceId, context.userId, permissionKey);
    }

    return {
      moduleKeys: tool.moduleKeys,
      permissionKeys: tool.permissionKeys,
    };
  }
}
