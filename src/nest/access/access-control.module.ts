import { Global, Module } from "@nestjs/common";

import { PermissionPolicy } from "../../core/authorization/PermissionPolicy.js";
import { ModuleAccessPolicy } from "../../core/module-access/ModuleAccessPolicy.js";
import { TenancyGuard } from "../../core/tenancy/TenancyGuard.js";
import { WorkspaceMembershipPrismaReader } from "../../database/WorkspaceMembershipPrismaReader.js";
import { WorkspacePermissionPrismaReader } from "../../database/WorkspacePermissionPrismaReader.js";
import { PrismaModuleAccessRepository } from "../../modules/module-management/infra/PrismaModuleAccessRepository.js";

@Global()
@Module({
  providers: [
    {
      provide: TenancyGuard,
      useFactory: (membershipReader: WorkspaceMembershipPrismaReader) => new TenancyGuard(membershipReader),
      inject: [WorkspaceMembershipPrismaReader],
    },
    {
      provide: PermissionPolicy,
      useFactory: (permissionReader: WorkspacePermissionPrismaReader) => new PermissionPolicy(permissionReader),
      inject: [WorkspacePermissionPrismaReader],
    },
    {
      provide: ModuleAccessPolicy,
      useFactory: (moduleAccessRepository: PrismaModuleAccessRepository) => new ModuleAccessPolicy(moduleAccessRepository),
      inject: [PrismaModuleAccessRepository],
    },
  ],
  exports: [
    TenancyGuard,
    PermissionPolicy,
    ModuleAccessPolicy,
  ],
})
export class AccessControlModule {}
