import { Module } from "@nestjs/common";

import { AiProviderSettingsService } from "../../modules/ai-runtime/services/AiProviderSettingsService.js";
import { DocumentArchiveService } from "../../modules/document-archive/services/DocumentArchiveService.js";
import { BackendPythonModulesClient } from "../../modules/document-intelligence/services/BackendPythonModulesClient.js";
import { DocumentIntelligenceService } from "../../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { MailProviderSettingsService } from "../../modules/mail-runtime/services/MailProviderSettingsService.js";
import { MeasureReportAnalyzer } from "../../modules/measure-report/services/MeasureReportAnalyzer.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { ConnectedAppsService } from "../../modules/connected-apps/services/ConnectedAppsService.js";
import { NextOrchestratorDdtAnalyzer } from "../../modules/ddt-processing/services/NextOrchestratorDdtAnalyzer.js";
import { NextOrchestratorQuotationAnalyzer } from "../../modules/quotation-orchestrator/services/NextOrchestratorQuotationAnalyzer.js";
import { PrismaWorkflowRepository } from "../../modules/workflows/infra/PrismaWorkflowRepository.js";
import { QueueWorkflowRunDispatcher } from "../../modules/workflows/services/QueueWorkflowRunDispatcher.js";
import { ScheduledWorkflowDeliveryService } from "../../modules/workflows/services/ScheduledWorkflowDeliveryService.js";
import { WorkflowRunExecutorService } from "../../modules/workflows/services/WorkflowRunExecutorService.js";
import { WorkflowRuntimeAccessPolicy } from "../../modules/workflows/services/WorkflowRuntimeAccessPolicy.js";
import { ModuleAccessPolicy } from "../../core/module-access/ModuleAccessPolicy.js";
import { WorkflowService } from "../../modules/workflows/services/WorkflowService.js";
import { JobQueue } from "../../worker/queue/JobQueue.js";
import { AuthModule } from "../auth/auth.module.js";
import { JOB_QUEUE } from "../common/tokens.js";
import { ConnectedAppsNestModule } from "../connected-apps/connected-apps.module.js";
import { DocumentArchiveNestModule } from "../document-archive/document-archive.module.js";
import { KnowledgeNestModule } from "../knowledge/knowledge.module.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { OrchestrationSupportNestModule } from "../orchestration-support/orchestration-support.module.js";
import { NestWorkflowsController } from "./workflows.controller.js";

@Module({
  imports: [
    AuthModule,
    ConnectedAppsNestModule,
    DocumentArchiveNestModule,
    KnowledgeNestModule,
    NotificationsNestModule,
    OrchestrationSupportNestModule,
  ],
  controllers: [NestWorkflowsController],
  providers: [
    {
      provide: WorkflowRuntimeAccessPolicy,
      useFactory: (moduleAccessPolicy: ModuleAccessPolicy) => new WorkflowRuntimeAccessPolicy(moduleAccessPolicy),
      inject: [ModuleAccessPolicy],
    },
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
      provide: ScheduledWorkflowDeliveryService,
      useFactory: (pythonModulesClient: BackendPythonModulesClient) =>
        new ScheduledWorkflowDeliveryService(pythonModulesClient),
      inject: [BackendPythonModulesClient],
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
        aiProviderSettingsService: AiProviderSettingsService,
        mailProviderSettingsService: MailProviderSettingsService,
        notificationService: NotificationService,
        jobQueue: JobQueue,
        scheduledWorkflowDeliveryService: ScheduledWorkflowDeliveryService,
        connectedAppsService: ConnectedAppsService,
        runtimeAccessPolicy: WorkflowRuntimeAccessPolicy,
      ) => new WorkflowRunExecutorService({
        documentArchiveService,
        documentIntelligenceService,
        quotationAnalyzer,
        ddtAnalyzer,
        measureReportAnalyzer,
        pythonModulesClient,
        aiProviderSettingsService,
        mailProviderSettingsService,
        notificationService,
        jobQueue,
        scheduledWorkflowDeliveryService,
        connectedAppsService,
        runtimeAccessPolicy,
      }),
      inject: [
        DocumentArchiveService,
        DocumentIntelligenceService,
        NextOrchestratorQuotationAnalyzer,
        NextOrchestratorDdtAnalyzer,
        MeasureReportAnalyzer,
        BackendPythonModulesClient,
        AiProviderSettingsService,
        MailProviderSettingsService,
        NotificationService,
        JOB_QUEUE,
        ScheduledWorkflowDeliveryService,
        ConnectedAppsService,
        WorkflowRuntimeAccessPolicy,
      ],
    },
  ],
  exports: [WorkflowService, WorkflowRunExecutorService, ScheduledWorkflowDeliveryService],
})
export class WorkflowsNestModule {}
