import { Module } from "@nestjs/common";

import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { PrismaProjectRepository } from "../../modules/projects/infra/PrismaProjectRepository.js";
import { ProjectService } from "../../modules/projects/services/ProjectService.js";
import { AuditNestModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { NestProjectsController } from "./projects.controller.js";

@Module({
  imports: [AuthModule, AuditNestModule, NotificationsNestModule],
  controllers: [NestProjectsController],
  providers: [
    {
      provide: ProjectService,
      useFactory: (
        repository: PrismaProjectRepository,
        notificationService: NotificationService,
        auditLogService: AuditLogService,
      ) => new ProjectService(
        repository, notificationService, auditLogService,
      ),
      inject: [PrismaProjectRepository, NotificationService, AuditLogService],
    },
  ],
  exports: [ProjectService],
})
export class ProjectsNestModule {}
