import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";

import { PermissionPolicy } from "../../core/authorization/PermissionPolicy.js";
import { ModuleAccessPolicy } from "../../core/module-access/ModuleAccessPolicy.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { REQUIRED_MODULE_METADATA_KEY } from "../common/decorators/require-module.decorator.js";
import { REQUIRED_PERMISSION_METADATA_KEY } from "../common/decorators/require-permission.decorator.js";

@Injectable()
export class AccessPolicyGuard implements CanActivate {
  public constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(ModuleAccessPolicy)
    private readonly moduleAccessPolicy: ModuleAccessPolicy,
    @Inject(PermissionPolicy)
    private readonly permissionPolicy: PermissionPolicy,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModules = this.collectMetadataValues(REQUIRED_MODULE_METADATA_KEY, context);
    const requiredPermissions = this.collectMetadataValues(REQUIRED_PERMISSION_METADATA_KEY, context);

    if (requiredModules.length === 0 && requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { requestContext?: RequestContext }>();
    const requestContext = request.requestContext;
    if (!requestContext) {
      return false;
    }

    for (const requiredModule of requiredModules) {
      await this.moduleAccessPolicy.ensureEnabled(
        requestContext.workspace.workspaceId,
        requestContext.workspace.userId,
        requiredModule,
      );
    }

    for (const requiredPermission of requiredPermissions) {
      await this.permissionPolicy.ensureAllowed(
        requestContext.workspace.workspaceId,
        requestContext.workspace.userId,
        requiredPermission,
      );
    }

    return true;
  }

  private normalizeValues(value: string[] | string | undefined): string[] {
    if (!value) {
      return [];
    }

    const values = Array.isArray(value) ? value : [value];
    return [...new Set(values.filter((item) => typeof item === "string" && item.trim().length > 0))];
  }

  private collectMetadataValues(key: string, context: ExecutionContext): string[] {
    const handlerValue = this.reflector.get<string[] | string | undefined>(key, context.getHandler());
    const classValue = this.reflector.get<string[] | string | undefined>(key, context.getClass());
    return [...new Set([...this.normalizeValues(classValue), ...this.normalizeValues(handlerValue)])];
  }
}
