import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { AccessControlModule } from "./access/access-control.module.js";
import { AuditNestModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AssistantNestModule } from "./assistant/assistant.module.js";
import { HttpErrorFilter } from "./common/filters/http-error.filter.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { AgentsNestModule } from "./agents/agents.module.js";
import { BackendProvidersModule } from "./providers/backend-providers.module.js";
import { ConnectedAppsNestModule } from "./connected-apps/connected-apps.module.js";
import { DdtReaderNestModule } from "./ddt-reader/ddt-reader.module.js";
import { DocumentArchiveNestModule } from "./document-archive/document-archive.module.js";
import { HealthModule } from "./health/health.module.js";
import { InfrastructureModule } from "./infrastructure/infrastructure.module.js";
import { KnowledgeNestModule } from "./knowledge/knowledge.module.js";
import { MeasureReportNestModule } from "./measure-report/measure-report.module.js";
import { ModuleManagementNestModule } from "./module-management/module-management.module.js";
import { NotificationsNestModule } from "./notifications/notifications.module.js";
import { OperationsNestModule } from "./operations/operations.module.js";
import { OrchestratorNestModule } from "./orchestrator/orchestrator.module.js";
import { PreferencesNestModule } from "./preferences/preferences.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ProjectAssetsNestModule } from "./project-assets/project-assets.module.js";
import { ProjectsNestModule } from "./projects/projects.module.js";
import { ProjectCrudNestModule } from "./project-crud/project-crud.module.js";
import { SuperadminNestModule } from "./superadmin/superadmin.module.js";
import { RuntimeNestModule } from "./runtime/runtime.module.js";
import { SettingsNestModule } from "./settings/settings.module.js";
import { WorkflowsNestModule } from "./workflows/workflows.module.js";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    BackendProvidersModule,
    InfrastructureModule,
    AccessControlModule,
    AuthModule,
    AuditNestModule,
    AgentsNestModule,
    AssistantNestModule,
    ConnectedAppsNestModule,
    DdtReaderNestModule,
    DocumentArchiveNestModule,
    KnowledgeNestModule,
    MeasureReportNestModule,
    ModuleManagementNestModule,
    PreferencesNestModule,
    NotificationsNestModule,
    OperationsNestModule,
    OrchestratorNestModule,
    ProjectAssetsNestModule,
    ProjectCrudNestModule,
    ProjectsNestModule,
    SettingsNestModule,
    SuperadminNestModule,
    WorkflowsNestModule,
    RuntimeNestModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpErrorFilter,
    },
  ],
})
export class AppModule {}
