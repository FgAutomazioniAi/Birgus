import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { BrainywareClient } from "../../modules/brainyware/services/BrainywareClient.js";
import { BrainyWorkspaceAgentService } from "../../modules/brainyware/services/BrainyWorkspaceAgentService.js";
import { BrainyWorkspaceDatabaseConnectionService } from "../../modules/brainyware/services/BrainyWorkspaceDatabaseConnectionService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";

@Controller("/api/brainyware")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.WORKFLOW_MANAGEMENT)
export class BrainywareController {
  public constructor(
    @Inject(BrainywareClient)
    private readonly client: BrainywareClient,
    @Inject(BrainyWorkspaceAgentService)
    private readonly workspaceAgentService: BrainyWorkspaceAgentService,
    @Inject(BrainyWorkspaceDatabaseConnectionService)
    private readonly workspaceDatabaseConnectionService: BrainyWorkspaceDatabaseConnectionService,
  ) {}

  @Get("catalog")
  @RequirePermission(PermissionKey.WORKFLOWS_READ)
  public async catalog(@CurrentRequestContext() context: RequestContext): Promise<Record<string, unknown>> {
    const configured = await this.client.isConfigured();
    if (!configured) return { configured: false, models: [], databaseConnections: [], agents: [] };

    const [models, databaseConnections, agents] = await Promise.all([
      this.client.listModels(),
      this.workspaceDatabaseConnectionService.listForWorkflowUser(context.workspace.workspaceId, context.workspace.userId),
      this.workspaceAgentService.listForWorkflowUser(context.workspace.workspaceId, context.workspace.userId),
    ]);
    return { configured: true, models, databaseConnections: databaseConnections.map((connection) => ({ id: connection.brainywareConnectionId, name: connection.label, dbType: null })), agents };
  }
}
