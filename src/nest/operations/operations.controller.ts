import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { OperationsInsightService } from "../../modules/operations/services/OperationsInsightService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

@Controller()
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
export class OperationsController {
  public constructor(
    @Inject(OperationsInsightService)
    private readonly operationsInsightService: OperationsInsightService,
  ) {}

  @Get("/api/operations/my-queue")
  public async listMyQueuedOperations(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { workspaceId, userId } = requestContext.workspace;
    return {
      operations: await this.operationsInsightService.listMyQueuedOperations(workspaceId, userId),
    };
  }

  @Get("/api/customer-map")
  @RequireModule(ModuleKey.CUSTOMER_MAP)
  @RequirePermission(PermissionKey.CUSTOMER_MAP_READ)
  public async listCustomerMap(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    return this.operationsInsightService.listCustomerMap(requestContext.workspace.workspaceId);
  }

  @Get("/api/offer-priority")
  @RequireModule(ModuleKey.OFFER_PRIORITY)
  @RequirePermission(PermissionKey.OFFER_PRIORITY_READ)
  public async listOfferPriority(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    return this.operationsInsightService.listOfferPriority(requestContext.workspace.workspaceId);
  }

  @Get("/api/maintenance-proposals")
  @RequireModule(ModuleKey.MAINTENANCE_PROPOSALS)
  @RequirePermission(PermissionKey.MAINTENANCE_PROPOSALS_READ)
  public async listMaintenanceProposals(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    return this.operationsInsightService.listMaintenanceProposals(requestContext.workspace.workspaceId);
  }

  @Get("/api/maintenance-calendar")
  @RequireModule(ModuleKey.MAINTENANCE_CALENDAR)
  @RequirePermission(PermissionKey.MAINTENANCE_CALENDAR_READ)
  public async listMaintenanceCalendar(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Array<Record<string, unknown>>> {
    return this.operationsInsightService.listMaintenanceCalendar(requestContext.workspace.workspaceId);
  }
}
