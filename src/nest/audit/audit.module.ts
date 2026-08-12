import { Module } from "@nestjs/common";

import { PrismaAuditLogRepository } from "../../modules/audit/infra/PrismaAuditLogRepository.js";
import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { AuthModule } from "../auth/auth.module.js";
import { NestAuditController } from "./audit.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [NestAuditController],
  providers: [
    {
      provide: AuditLogService,
      useFactory: (repository: PrismaAuditLogRepository) => new AuditLogService(repository),
      inject: [PrismaAuditLogRepository],
    },
  ],
  exports: [AuditLogService],
})
export class AuditNestModule {}
