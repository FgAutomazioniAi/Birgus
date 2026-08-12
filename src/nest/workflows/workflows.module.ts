import { Module } from "@nestjs/common";

import { DocumentArchiveService } from "../../modules/document-archive/services/DocumentArchiveService.js";
import { BackendPythonModulesClient } from "../../modules/document-intelligence/services/BackendPythonModulesClient.js";
import { DocumentIntelligenceService } from "../../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { MeasureReportAnalyzer } from "../../modules/measure-report/services/MeasureReportAnalyzer.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { NextOrchestratorDdtAnalyzer } from "../../modules/ddt-processing/services/NextOrchestratorDdtAnalyzer.js";
import { NextOrchestratorQuotationAnalyzer } from "../../modules/quotation-orchestrator/services/NextOrchestratorQuotationAnalyzer.js";
import { PrismaWorkflowRepository } from "../../modules/workflows/infra/PrismaWorkflowRepository.js";
import { QueueWorkflowRunDispatcher } from "../../modules/workflows/services/QueueWorkflowRunDispatcher.js";
import { WorkflowRunExecutorService } from "../../modules/workflows/services/WorkflowRunExecutorService.js";
import { WorkflowService } from "../../modules/workflows/services/WorkflowService.js";
import { JobQueue } from "../../worker/queue/JobQueue.js";
import { AuthModule } from "../auth/auth.module.js";
import { JOB_QUEUE } from "../common/tokens.js";
import { DocumentArchiveNestModule } from "../document-archive/document-archive.module.js";
import { KnowledgeNestModule } from "../knowledge/knowledge.module.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { OrchestrationSupportNestModule } from "../orchestration-support/orchestration-support.module.js";
import { NestWorkflowsController } from "./workflows.controller.js";

@Module({
  imports: [
    AuthModule,
    DocumentArchiveNestModule,
    KnowledgeNestModule,
    NotificationsNestModule,
    OrchestrationSupportNestModule,
  ],
  controllers: [NestWorkflowsController],
  providers: [
    {
      provide: QueueWorkflowRunDispatcher,
      useFactory: (jobQueue: JobQueue) => new QueueWorkflowRunDispatcher(jobQueue),
      inject: [JOB_QUEUE],
    },
    {
      provide: WorkflowService,
      useFactory: (
        repository: PrismaWorkflowRepository,
        runDispatcher: QueueWorkflowRunDispatcher,
      ) => new WorkflowService(
        repository,
        runDispatcher,
      ),
      inject: [PrismaWorkflowRepository, QueueWorkflowRunDispatcher],
    },
    {
      provide: WorkflowRunExecutorService,
      useFactory: (
        documentArchiveService: DocumentArchiveService,
        documentIntelligenceService: DocumentIntelligenceService,
        quotationAnalyzer: NextOrchestratorQuotationAnalyzer,
        ddtAnalyzer: NextOrchestratorDdtAnalyzer,
        measureReportAnalyzer: MeasureReportAnalyzer,
        pythonModulesClient: BackendPythonModulesClient,
        notificationService: NotificationService,
        jobQueue: JobQueue,
      ) => new WorkflowRunExecutorService({
        documentArchiveService,
        documentIntelligenceService,
        quotationAnalyzer,
        ddtAnalyzer,
        measureReportAnalyzer,
        pythonModulesClient,
        notificationService,
        jobQueue,
      }),
      inject: [
        DocumentArchiveService,
        DocumentIntelligenceService,
        NextOrchestratorQuotationAnalyzer,
        NextOrchestratorDdtAnalyzer,
        MeasureReportAnalyzer,
        BackendPythonModulesClient,
        NotificationService,
        JOB_QUEUE,
      ],
    },
  ],
  exports: [WorkflowService, WorkflowRunExecutorService],
})
export class WorkflowsNestModule {}
