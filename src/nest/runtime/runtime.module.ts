import { Module } from "@nestjs/common";

import { PrismaDdtProcessingRepository } from "../../modules/ddt-processing/infra/PrismaDdtProcessingRepository.js";
import { NextOrchestratorDdtAnalyzer } from "../../modules/ddt-processing/services/NextOrchestratorDdtAnalyzer.js";
import { DocumentIntelligenceService } from "../../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { WorkflowRunExecutorService } from "../../modules/workflows/services/WorkflowRunExecutorService.js";
import { JobQueue } from "../../worker/queue/JobQueue.js";
import { DdtProcessingWorker } from "../../worker/services/DdtProcessingWorker.js";
import { QuotationOrchestratorWorker } from "../../worker/services/QuotationOrchestratorWorker.js";
import { WorkerCoordinator } from "../../worker/services/WorkerCoordinator.js";
import { WorkflowRunWorker } from "../../worker/services/WorkflowRunWorker.js";
import { JOB_QUEUE } from "../common/tokens.js";
import { DdtReaderNestModule } from "../ddt-reader/ddt-reader.module.js";
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
    DdtReaderNestModule,
    KnowledgeNestModule,
    NotificationsNestModule,
    OrchestrationSupportNestModule,
    ProjectAssetsNestModule,
    WorkflowsNestModule,
  ],
  providers: [
    {
      provide: DdtProcessingWorker,
      useFactory: (
        repository: PrismaDdtProcessingRepository,
        analyzer: NextOrchestratorDdtAnalyzer,
        documentIntelligenceService: DocumentIntelligenceService,
        notificationService: NotificationService,
      ) => new DdtProcessingWorker(
        repository,
        analyzer,
        documentIntelligenceService,
        notificationService,
      ),
      inject: [
        PrismaDdtProcessingRepository,
        NextOrchestratorDdtAnalyzer,
        DocumentIntelligenceService,
        NotificationService,
      ],
    },
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
        ddtProcessingWorker: DdtProcessingWorker,
        workflowRunWorker: WorkflowRunWorker,
        quotationOrchestratorWorker: QuotationOrchestratorWorker,
      ) => new WorkerCoordinator(
        jobQueue,
        ddtProcessingWorker,
        workflowRunWorker,
        quotationOrchestratorWorker,
      ),
      inject: [JOB_QUEUE, DdtProcessingWorker, WorkflowRunWorker, QuotationOrchestratorWorker],
    },
    BackendRuntimeService,
  ],
  exports: [BackendRuntimeService],
})
export class RuntimeNestModule {}
