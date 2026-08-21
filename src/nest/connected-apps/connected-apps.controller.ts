import { Controller, Delete, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { ConnectedAppsService } from "../../modules/connected-apps/services/ConnectedAppsService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";

const providerSchema = z.enum(["telegram"]);

@Controller("/api/connected-apps")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.WORKFLOW_MANAGEMENT)
export class ConnectedAppsController {
  public constructor(
    @Inject(ConnectedAppsService)
    private readonly service: ConnectedAppsService,
  ) {}

  @Get()
  public async list(
    @Query("provider") providerRaw: string | undefined,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const provider = providerRaw ? providerSchema.parse(providerRaw) : undefined;
    const apps = await this.service.listUserApps({
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      provider,
    });

    return {
      apps,
      connectableApps: [
        {
          provider: "telegram",
          label: "Telegram",
          description: "Usa il tuo account Telegram per i nodi Resoconto nei workflow.",
          status: apps.some((app) => app.provider === "telegram") ? "connected" : "available",
        },
      ],
    };
  }

  @Post("telegram/link-code")
  @HttpCode(201)
  public async createTelegramLinkCode(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const link = await this.service.createTelegramLinkCode({
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
    });
    return { link };
  }

  @Delete(":appId")
  @HttpCode(204)
  public async remove(
    @Param("appId") appId: string,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<void> {
    await this.service.deleteUserApp({
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      appId,
    });
  }
}
