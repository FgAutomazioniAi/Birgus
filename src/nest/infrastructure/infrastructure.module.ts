import { Global, Module } from "@nestjs/common";

import { AiGatewayService } from "../../modules/ai-runtime/services/AiGatewayService.js";
import { OpenAiCompatibleLmClient } from "../../modules/ai-runtime/services/OpenAiCompatibleLmClient.js";
import { BackendPythonModulesClient } from "../../modules/document-intelligence/services/BackendPythonModulesClient.js";
import { LocalLmOrchestrator } from "../../modules/orchestration/services/LocalLmOrchestrator.js";
import { StorageSelector } from "../../storage/StorageSelector.js";
import { PostgresJobQueue } from "../../worker/queue/PostgresJobQueue.js";
import { JOB_QUEUE, PROJECT_BINARY_STORAGE } from "../common/tokens.js";

@Global()
@Module({
  providers: [
    {
      provide: PROJECT_BINARY_STORAGE,
      useFactory: () => StorageSelector.create(),
    },
    {
      provide: JOB_QUEUE,
      useFactory: () => new PostgresJobQueue(),
    },
    {
      provide: BackendPythonModulesClient,
      useFactory: () => new BackendPythonModulesClient(),
    },
    {
      provide: OpenAiCompatibleLmClient,
      useFactory: () => new OpenAiCompatibleLmClient(),
    },
    {
      provide: AiGatewayService,
      useFactory: (lmClient: OpenAiCompatibleLmClient) => new AiGatewayService(lmClient),
      inject: [OpenAiCompatibleLmClient],
    },
    {
      provide: LocalLmOrchestrator,
      useFactory: (
        pythonModulesClient: BackendPythonModulesClient,
        lmClient: OpenAiCompatibleLmClient,
      ) => new LocalLmOrchestrator(pythonModulesClient, lmClient),
      inject: [BackendPythonModulesClient, OpenAiCompatibleLmClient],
    },
  ],
  exports: [
    PROJECT_BINARY_STORAGE,
    JOB_QUEUE,
    BackendPythonModulesClient,
    AiGatewayService,
    OpenAiCompatibleLmClient,
    LocalLmOrchestrator,
  ],
})
export class InfrastructureModule {}
