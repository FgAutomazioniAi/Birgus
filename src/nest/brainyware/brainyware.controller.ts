import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { BrainywareClient } from "../../modules/brainyware/services/BrainywareClient.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

@Controller("/api/brainyware")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.WORKFLOW_MANAGEMENT)
export class BrainywareController {
  public constructor(
    @Inject(BrainywareClient)
    private readonly client: BrainywareClient,
  ) {}

  @Get("catalog")
  @RequirePermission(PermissionKey.WORKFLOWS_READ)
  public async catalog(): Promise<Record<string, unknown>> {
    const configured = await this.client.isConfigured();
    if (!configured) return { configured: false, models: [], databaseConnections: [] };

    const [models, databaseConnections] = await Promise.all([
      this.client.listModels(),
      this.client.listDatabaseConnections(),
    ]);
    return { configured: true, models, databaseConnections };
  }
}
