import { Module } from "@nestjs/common";

import { PrismaAuthSessionRepository } from "../../modules/identity/infra/PrismaAuthSessionRepository.js";
import { PasswordHasher } from "../../modules/identity/services/PasswordHasher.js";
import { SuperadminService } from "../../modules/superadmin/services/SuperadminService.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuditNestModule } from "../audit/audit.module.js";
import { DocumentArchiveNestModule } from "../document-archive/document-archive.module.js";
import { ModuleManagementNestModule } from "../module-management/module-management.module.js";
import { BackendProvidersModule } from "../providers/backend-providers.module.js";
import { ArchivedItemsService } from "../../modules/document-archive/services/ArchivedItemsService.js";
import { ModuleManagementService } from "../../modules/module-management/services/ModuleManagementService.js";
import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { NestSuperadminController } from "./superadmin.controller.js";

@Module({
  imports: [AuthModule, AuditNestModule, BackendProvidersModule, DocumentArchiveNestModule, ModuleManagementNestModule],
  controllers: [NestSuperadminController],
  providers: [
    {
      provide: SuperadminService,
      useFactory: (
        archivedItemsService: ArchivedItemsService,
        passwordHasher: PasswordHasher,
        authSessionRepository: PrismaAuthSessionRepository,
        moduleManagementService: ModuleManagementService,
        auditLogService: AuditLogService,
      ) => new SuperadminService({
        archivedItemsService,
        passwordHasher,
        authSessionRepository,
        moduleManagementService,
        auditLogService,
      }),
      inject: [
        ArchivedItemsService,
        PasswordHasher,
        PrismaAuthSessionRepository,
        ModuleManagementService,
        AuditLogService,
      ],
    },
  ],
})
export class SuperadminNestModule {}
