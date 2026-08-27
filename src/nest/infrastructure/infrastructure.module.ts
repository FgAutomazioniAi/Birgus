import { Global, Module } from "@nestjs/common";

import { AiProviderSettingsService } from "../../modules/ai-runtime/services/AiProviderSettingsService.js";
import { AiGatewayService } from "../../modules/ai-runtime/services/AiGatewayService.js";
import { OpenAiCompatibleLmClient } from "../../modules/ai-runtime/services/OpenAiCompatibleLmClient.js";
import { VllmLifecycleService } from "../../modules/ai-runtime/services/VllmLifecycleService.js";
import { BackendPythonModulesClient } from "../../modules/document-intelligence/services/BackendPythonModulesClient.js";
import { MailProviderSettingsService } from "../../modules/mail-runtime/services/MailProviderSettingsService.js";
import { LocalLmOrchestrator } from "../../modules/orchestration/services/LocalLmOrchestrator.js";
import { StorageSelector } from "../../storage/StorageSelector.js";
import { PostgresJobQueue } from "../../worker/queue/PostgresJobQueue.js";
import { JOB_QUEUE, PROJECT_BINARY_STORAGE } from "../common/tokens.js";
import { PrismaService } from "../prisma/prisma.service.js";

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
      provide: AiProviderSettingsService,
      useFactory: (prisma: PrismaService) => new AiProviderSettingsService(prisma),
      inject: [PrismaService],
    },
    {
      provide: VllmLifecycleService,
      useFactory: () => new VllmLifecycleService(),
    },
    {
      provide: MailProviderSettingsService,
      useFactory: (prisma: PrismaService) => new MailProviderSettingsService(prisma),
      inject: [PrismaService],
    },
    {
      provide: OpenAiCompatibleLmClient,
      useFactory: (settingsService: AiProviderSettingsService) => {
        OpenAiCompatibleLmClient.setRuntimeConfigResolver(() => settingsService.getRuntimeConfig());
        return new OpenAiCompatibleLmClient();
      },
      inject: [AiProviderSettingsService],
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
    AiProviderSettingsService,
    VllmLifecycleService,
    MailProviderSettingsService,
    BackendPythonModulesClient,
    AiGatewayService,
    OpenAiCompatibleLmClient,
    LocalLmOrchestrator,
  ],
})
export class InfrastructureModule {}
