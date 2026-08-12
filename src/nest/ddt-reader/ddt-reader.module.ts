import { Module } from "@nestjs/common";

import { PrismaDdtProcessingRepository } from "../../modules/ddt-processing/infra/PrismaDdtProcessingRepository.js";
import { DdtProcessingService } from "../../modules/ddt-processing/services/DdtProcessingService.js";
import { DdtReaderService } from "../../modules/ddt-processing/services/DdtReaderService.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { WorkflowService } from "../../modules/workflows/services/WorkflowService.js";
import { JobQueue } from "../../worker/queue/JobQueue.js";
import { ProjectBinaryStorage } from "../../storage/ProjectBinaryStorage.js";
import { AuthModule } from "../auth/auth.module.js";
import { JOB_QUEUE, PROJECT_BINARY_STORAGE } from "../common/tokens.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { BackendProvidersModule } from "../providers/backend-providers.module.js";
import { WorkflowsNestModule } from "../workflows/workflows.module.js";
import { NestDdtController } from "../ddt-processing/ddt.controller.js";
import { NestDdtReaderController } from "./ddt-reader.controller.js";

@Module({
  imports: [AuthModule, BackendProvidersModule, NotificationsNestModule, WorkflowsNestModule],
  controllers: [NestDdtReaderController, NestDdtController],
  providers: [
    {
      provide: DdtProcessingService,
      useFactory: (repository: PrismaDdtProcessingRepository, jobQueue: JobQueue) => new DdtProcessingService(repository, jobQueue),
      inject: [PrismaDdtProcessingRepository, JOB_QUEUE],
    },
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
  exports: [DdtProcessingService, DdtReaderService],
})
export class DdtReaderNestModule {}
