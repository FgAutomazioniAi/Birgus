import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { VllmLifecycleService } from "../../modules/ai-runtime/services/VllmLifecycleService.js";
import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";

const updateMaxModelLenSchema = z
  .object({
    maxModelLen: z.number().int().min(1024).max(32768),
  })
  .strict();

@Controller("/api/settings/vllm-runtime")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.AI_RUNTIME_CONTROL)
export class VllmRuntimeController {
  public constructor(
    @Inject(VllmLifecycleService)
    private readonly lifecycleService: VllmLifecycleService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
  ) {}

  @Get()
  @RequirePermission(PermissionKey.MODULES_CONFIGURE)
  public async getRuntimeStatus(): Promise<Record<string, unknown>> {
    return { runtime: await this.lifecycleService.getRuntimeStatus() };
  }

  @Post("max-model-len")
  @HttpCode(200)
  @RequirePermission(PermissionKey.MODULES_CONFIGURE)
  public async updateMaxModelLen(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() context: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = updateMaxModelLenSchema.parse(bodyRaw ?? {});
    const runtime = await this.lifecycleService.updateMaxModelLen(
      body.maxModelLen,
    );
    await this.auditLogService.record({
      workspaceId: context.workspace.workspaceId,
      userId: context.workspace.userId,
      moduleKey: ModuleKey.AI_RUNTIME_CONTROL,
      action: "settings.ai_runtime.updated",
      entityType: "AiRuntime",
      payload: { maxModelLen: body.maxModelLen },
    });
    return { runtime };
  }
}
