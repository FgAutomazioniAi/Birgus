import { Module } from "@nestjs/common";

import { MeasureReportService } from "../../modules/measure-report/services/MeasureReportService.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { WorkflowService } from "../../modules/workflows/services/WorkflowService.js";
import { ProjectBinaryStorage } from "../../storage/ProjectBinaryStorage.js";
import { AuthModule } from "../auth/auth.module.js";
import { PROJECT_BINARY_STORAGE } from "../common/tokens.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { WorkflowsNestModule } from "../workflows/workflows.module.js";
import { NestMeasureReportController } from "./measure-report.controller.js";

@Module({
  imports: [AuthModule, NotificationsNestModule, WorkflowsNestModule],
  controllers: [NestMeasureReportController],
  providers: [
    {
      provide: MeasureReportService,
      useFactory: (
        storage: ProjectBinaryStorage,
        workflowService: WorkflowService,
        notificationService: NotificationService,
      ) => new MeasureReportService(storage, workflowService, notificationService),
      inject: [PROJECT_BINARY_STORAGE, WorkflowService, NotificationService],
    },
  ],
})
export class MeasureReportNestModule {}
