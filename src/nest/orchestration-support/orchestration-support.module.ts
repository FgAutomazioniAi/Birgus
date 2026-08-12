import { Module } from "@nestjs/common";

import { OpenAiCompatibleLmClient } from "../../modules/ai-runtime/services/OpenAiCompatibleLmClient.js";
import { ModuleAgentService } from "../../modules/agents/services/ModuleAgentService.js";
import { NextOrchestratorDdtAnalyzer } from "../../modules/ddt-processing/services/NextOrchestratorDdtAnalyzer.js";
import { BackendPythonModulesClient } from "../../modules/document-intelligence/services/BackendPythonModulesClient.js";
import { MeasureReportAnalyzer } from "../../modules/measure-report/services/MeasureReportAnalyzer.js";
import { LocalLmOrchestrator } from "../../modules/orchestration/services/LocalLmOrchestrator.js";
import { NextOrchestratorQuotationAnalyzer } from "../../modules/quotation-orchestrator/services/NextOrchestratorQuotationAnalyzer.js";
import { AgentsNestModule } from "../agents/agents.module.js";

@Module({
  imports: [AgentsNestModule],
  providers: [
    {
      provide: NextOrchestratorDdtAnalyzer,
      useFactory: (
        moduleAgentService: ModuleAgentService,
        localLmOrchestrator: LocalLmOrchestrator,
      ) => new NextOrchestratorDdtAnalyzer(moduleAgentService, localLmOrchestrator),
      inject: [ModuleAgentService, LocalLmOrchestrator],
    },
    {
      provide: NextOrchestratorQuotationAnalyzer,
      useFactory: (
        moduleAgentService: ModuleAgentService,
        localLmOrchestrator: LocalLmOrchestrator,
      ) => new NextOrchestratorQuotationAnalyzer(moduleAgentService, localLmOrchestrator),
      inject: [ModuleAgentService, LocalLmOrchestrator],
    },
    {
      provide: MeasureReportAnalyzer,
      useFactory: (
        moduleAgentService: ModuleAgentService,
        pythonModulesClient: BackendPythonModulesClient,
        lmClient: OpenAiCompatibleLmClient,
      ) => new MeasureReportAnalyzer(moduleAgentService, pythonModulesClient, lmClient),
      inject: [ModuleAgentService, BackendPythonModulesClient, OpenAiCompatibleLmClient],
    },
  ],
  exports: [
    NextOrchestratorDdtAnalyzer,
    NextOrchestratorQuotationAnalyzer,
    MeasureReportAnalyzer,
  ],
})
export class OrchestrationSupportNestModule {}
