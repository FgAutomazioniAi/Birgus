import { Module } from "@nestjs/common";

import { PrismaModuleAccessRepository } from "../../modules/module-management/infra/PrismaModuleAccessRepository.js";
import { ModuleManagementService } from "../../modules/module-management/services/ModuleManagementService.js";
import { AuthModule } from "../auth/auth.module.js";
import { NestModuleManagementController } from "./module-management.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [NestModuleManagementController],
  providers: [
    {
      provide: ModuleManagementService,
      useFactory: (moduleAccessRepository: PrismaModuleAccessRepository) => new ModuleManagementService(moduleAccessRepository),
      inject: [PrismaModuleAccessRepository],
    },
  ],
  exports: [ModuleManagementService],
})
export class ModuleManagementNestModule {}
