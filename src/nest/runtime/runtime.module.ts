import { Module } from "@nestjs/common";

import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { WorkflowRunExecutorService } from "../../modules/workflows/services/WorkflowRunExecutorService.js";
import { TelegramLinkPollingService } from "../../modules/connected-apps/services/TelegramLinkPollingService.js";
import { JobQueue } from "../../worker/queue/JobQueue.js";
import { QuotationOrchestratorWorker } from "../../worker/services/QuotationOrchestratorWorker.js";
import { WorkerCoordinator } from "../../worker/services/WorkerCoordinator.js";
import { WorkflowRunWorker } from "../../worker/services/WorkflowRunWorker.js";
import { JOB_QUEUE } from "../common/tokens.js";
import { ConnectedAppsNestModule } from "../connected-apps/connected-apps.module.js";
import { KnowledgeNestModule } from "../knowledge/knowledge.module.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { OrchestrationSupportNestModule } from "../orchestration-support/orchestration-support.module.js";
import { BackendProvidersModule } from "../providers/backend-providers.module.js";
import { ProjectAssetsNestModule } from "../project-assets/project-assets.module.js";
import { WorkflowsNestModule } from "../workflows/workflows.module.js";
import { BackendRuntimeService } from "./runtime.service.js";

@Module({
  imports: [
    BackendProvidersModule,
    ConnectedAppsNestModule,
    KnowledgeNestModule,
    NotificationsNestModule,
    OrchestrationSupportNestModule,
    ProjectAssetsNestModule,
    WorkflowsNestModule,
  ],
  providers: [
    {
      provide: WorkflowRunWorker,
      useFactory: (executor: WorkflowRunExecutorService) => new WorkflowRunWorker(executor),
      inject: [WorkflowRunExecutorService],
    },
    {
      provide: QuotationOrchestratorWorker,
      useFactory: (service: QuotationOrchestratorService) => new QuotationOrchestratorWorker(service),
      inject: [QuotationOrchestratorService],
    },
    {
      provide: WorkerCoordinator,
      useFactory: (
        jobQueue: JobQueue,
        workflowRunWorker: WorkflowRunWorker,
        quotationOrchestratorWorker: QuotationOrchestratorWorker,
      ) => new WorkerCoordinator(
        jobQueue,
        workflowRunWorker,
        quotationOrchestratorWorker,
      ),
      inject: [JOB_QUEUE, WorkflowRunWorker, QuotationOrchestratorWorker],
    },
    BackendRuntimeService,
  ],
  exports: [BackendRuntimeService],
})
export class RuntimeNestModule {}
