import { PermissionPolicy } from "../../core/authorization/PermissionPolicy.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";

export class PermissionGuard {
  private readonly permissionPolicy: PermissionPolicy;

  public constructor(permissionPolicy: PermissionPolicy) {
    this.permissionPolicy = permissionPolicy;
  }

  public async requirePermission(requestContext: RequestContext, permissionKey: string): Promise<void> {
    await this.permissionPolicy.ensureAllowed(
      requestContext.workspace.workspaceId,
      requestContext.workspace.userId,
      permissionKey,
    );
  }
}
