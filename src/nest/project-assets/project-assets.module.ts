import { Module } from "@nestjs/common";

import { BackendPythonModulesClient } from "../../modules/document-intelligence/services/BackendPythonModulesClient.js";
import { DocumentIntelligenceService } from "../../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { ProjectService } from "../../modules/projects/services/ProjectService.js";
import { PrismaQuotationOrchestratorRepository } from "../../modules/quotation-orchestrator/infra/PrismaQuotationOrchestratorRepository.js";
import { NextOrchestratorQuotationAnalyzer } from "../../modules/quotation-orchestrator/services/NextOrchestratorQuotationAnalyzer.js";
import { PythonQuotationEmailNotifier } from "../../modules/quotation-orchestrator/services/PythonQuotationEmailNotifier.js";
import { QuotationDocxBuilder } from "../../modules/quotation-orchestrator/services/QuotationDocxBuilder.js";
import { QuotationOrchestratorService } from "../../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { WorkflowService } from "../../modules/workflows/services/WorkflowService.js";
import { JobQueue } from "../../worker/queue/JobQueue.js";
import { AuthModule } from "../auth/auth.module.js";
import { JOB_QUEUE } from "../common/tokens.js";
import { DocumentArchiveNestModule } from "../document-archive/document-archive.module.js";
import { KnowledgeNestModule } from "../knowledge/knowledge.module.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { OrchestrationSupportNestModule } from "../orchestration-support/orchestration-support.module.js";
import { ProjectsNestModule } from "../projects/projects.module.js";
import { WorkflowsNestModule } from "../workflows/workflows.module.js";
import { NestProjectAssetsController } from "./project-assets.controller.js";
import { DocumentArchiveService } from "../../modules/document-archive/services/DocumentArchiveService.js";

@Module({
  imports: [
    AuthModule,
    DocumentArchiveNestModule,
    KnowledgeNestModule,
    NotificationsNestModule,
    OrchestrationSupportNestModule,
    ProjectsNestModule,
    WorkflowsNestModule,
  ],
  controllers: [NestProjectAssetsController],
  providers: [
    {
      provide: QuotationDocxBuilder,
      useFactory: (pythonModulesClient: BackendPythonModulesClient) => new QuotationDocxBuilder(pythonModulesClient),
      inject: [BackendPythonModulesClient],
    },
    {
      provide: PythonQuotationEmailNotifier,
      useFactory: (pythonModulesClient: BackendPythonModulesClient) =>
        new PythonQuotationEmailNotifier(pythonModulesClient),
      inject: [BackendPythonModulesClient],
    },
    {
      provide: QuotationOrchestratorService,
      useFactory: (
        documentArchiveService: DocumentArchiveService,
        quotationAnalyzer: NextOrchestratorQuotationAnalyzer,
        docxBuilder: QuotationDocxBuilder,
        repository: PrismaQuotationOrchestratorRepository,
        emailNotifier: PythonQuotationEmailNotifier,
        documentIntelligenceService: DocumentIntelligenceService,
        workflowService: WorkflowService,
        jobQueue: JobQueue,
        notificationService: NotificationService,
      ) => new QuotationOrchestratorService(
        documentArchiveService,
        quotationAnalyzer,
        docxBuilder,
        repository,
        emailNotifier,
        documentIntelligenceService,
        workflowService,
        jobQueue,
        notificationService,
      ),
      inject: [
        DocumentArchiveService,
        NextOrchestratorQuotationAnalyzer,
        QuotationDocxBuilder,
        PrismaQuotationOrchestratorRepository,
        PythonQuotationEmailNotifier,
        DocumentIntelligenceService,
        WorkflowService,
        JOB_QUEUE,
        NotificationService,
      ],
    },
  ],
  exports: [QuotationOrchestratorService],
})
export class ProjectAssetsNestModule {}
