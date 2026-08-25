import { Module } from "@nestjs/common";

import { DdtReaderService } from "../../modules/ddt-processing/services/DdtReaderService.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { WorkflowService } from "../../modules/workflows/services/WorkflowService.js";
import { ProjectBinaryStorage } from "../../storage/ProjectBinaryStorage.js";
import { AuthModule } from "../auth/auth.module.js";
import { PROJECT_BINARY_STORAGE } from "../common/tokens.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { BackendProvidersModule } from "../providers/backend-providers.module.js";
import { WorkflowsNestModule } from "../workflows/workflows.module.js";
import { NestDdtReaderController } from "./ddt-reader.controller.js";

@Module({
  imports: [AuthModule, BackendProvidersModule, NotificationsNestModule, WorkflowsNestModule],
  controllers: [NestDdtReaderController],
  providers: [
    {
      provide: DdtReaderService,
      useFactory: (
        storage: ProjectBinaryStorage,
        workflowService: WorkflowService,
        notificationService: NotificationService,
      ) => new DdtReaderService(storage, workflowService, notificationService),
      inject: [PROJECT_BINARY_STORAGE, WorkflowService, NotificationService],
    },
  ],
  exports: [DdtReaderService],
})
export class DdtReaderNestModule {}
