import { Module } from "@nestjs/common";

import { PermissionPolicy } from "../../core/authorization/PermissionPolicy.js";
import { ModuleAccessPolicy } from "../../core/module-access/ModuleAccessPolicy.js";
import { OpenAiCompatibleToolChatClient } from "../../modules/ai-runtime/services/OpenAiCompatibleToolChatClient.js";
import { PrismaAssistantSessionRepository } from "../../modules/conversational-assistant/infra/PrismaAssistantSessionRepository.js";
import { AssistantConversationService } from "../../modules/conversational-assistant/services/AssistantConversationService.js";
import { AssistantSessionDocumentService } from "../../modules/conversational-assistant/services/AssistantSessionDocumentService.js";
import { AssistantSessionService } from "../../modules/conversational-assistant/services/AssistantSessionService.js";
import { AssistantToolAccessService } from "../../modules/conversational-assistant/services/AssistantToolAccessService.js";
import { AssistantToolRegistry } from "../../modules/conversational-assistant/services/AssistantToolRegistry.js";
import { DocumentIntelligenceService } from "../../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { ProjectService } from "../../modules/projects/services/ProjectService.js";
import { AuthModule } from "../auth/auth.module.js";
import { KnowledgeNestModule } from "../knowledge/knowledge.module.js";
import { ProjectsNestModule } from "../projects/projects.module.js";
import { NestAssistantController } from "./assistant.controller.js";

@Module({
  imports: [AuthModule, KnowledgeNestModule, ProjectsNestModule],
  controllers: [NestAssistantController],
  providers: [
    {
      provide: AssistantSessionService,
      useFactory: (repository: PrismaAssistantSessionRepository) => new AssistantSessionService(repository),
      inject: [PrismaAssistantSessionRepository],
    },
    {
      provide: AssistantToolRegistry,
      useFactory: (
        projectService: ProjectService,
        documentIntelligenceService: DocumentIntelligenceService,
      ) => new AssistantToolRegistry(projectService, documentIntelligenceService),
      inject: [ProjectService, DocumentIntelligenceService],
    },
    {
      provide: AssistantToolAccessService,
      useFactory: (
        moduleAccessPolicy: ModuleAccessPolicy,
        permissionPolicy: PermissionPolicy,
      ) => new AssistantToolAccessService(moduleAccessPolicy, permissionPolicy),
      inject: [ModuleAccessPolicy, PermissionPolicy],
    },
    {
      provide: AssistantSessionDocumentService,
      useFactory: (documentIntelligenceService: DocumentIntelligenceService) => new AssistantSessionDocumentService(documentIntelligenceService),
      inject: [DocumentIntelligenceService],
    },
    {
      provide: AssistantConversationService,
      useFactory: (
        sessionService: AssistantSessionService,
        toolRegistry: AssistantToolRegistry,
        toolAccessService: AssistantToolAccessService,
        documentIntelligenceService: DocumentIntelligenceService,
        chatClient: OpenAiCompatibleToolChatClient,
        repository: PrismaAssistantSessionRepository,
      ) => new AssistantConversationService({
        sessionService,
        toolRegistry,
        toolAccessService,
        documentIntelligenceService,
        chatClient,
        repository,
      }),
      inject: [
        AssistantSessionService,
        AssistantToolRegistry,
        AssistantToolAccessService,
        DocumentIntelligenceService,
        OpenAiCompatibleToolChatClient,
        PrismaAssistantSessionRepository,
      ],
    },
  ],
})
export class AssistantNestModule {}
