import { Module } from "@nestjs/common";

import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { PrismaCommissionIntakeRepository } from "../../modules/commission-intake/infra/PrismaCommissionIntakeRepository.js";
import type { CommissionIntakeRepository } from "../../modules/commission-intake/repositories/CommissionIntakeRepository.js";
import { CommissionIntakeService } from "../../modules/commission-intake/services/CommissionIntakeService.js";
import { CommissionVendorListService } from "../../modules/commission-intake/services/CommissionVendorListService.js";
import { ProjectBinaryStorage } from "../../storage/ProjectBinaryStorage.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { AuditNestModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { PROJECT_BINARY_STORAGE } from "../common/tokens.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { CommissionIntakeController } from "./commission-intake.controller.js";

@Module({
  imports: [AuthModule, AuditNestModule, NotificationsNestModule],
  controllers: [CommissionIntakeController],
  providers: [
    PrismaCommissionIntakeRepository,
    CommissionVendorListService,
    {
      provide: CommissionIntakeService,
      useFactory: (
        repository: CommissionIntakeRepository,
        storage: ProjectBinaryStorage,
        notificationService: NotificationService,
        auditLogService: AuditLogService,
      ) => new CommissionIntakeService(repository, storage, notificationService, auditLogService),
      inject: [PrismaCommissionIntakeRepository, PROJECT_BINARY_STORAGE, NotificationService, AuditLogService],
    },
  ],
  exports: [CommissionIntakeService],
})
export class CommissionIntakeNestModule {}
