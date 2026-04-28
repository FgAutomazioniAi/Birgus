import { ModuleAccessPolicy } from "../../core/module-access/ModuleAccessPolicy.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";

export class ModuleGuard {
  private readonly moduleAccessPolicy: ModuleAccessPolicy;

  public constructor(moduleAccessPolicy: ModuleAccessPolicy) {
    this.moduleAccessPolicy = moduleAccessPolicy;
  }

  public async requireModule(requestContext: RequestContext, moduleKey: string): Promise<void> {
    await this.moduleAccessPolicy.ensureEnabled(
      requestContext.workspace.workspaceId,
      requestContext.workspace.userId,
      moduleKey,
    );
  }
}
