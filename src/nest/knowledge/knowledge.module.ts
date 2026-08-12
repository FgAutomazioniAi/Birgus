import { Module } from "@nestjs/common";

import { DocumentIntelligenceService } from "../../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { BackendPythonModulesClient } from "../../modules/document-intelligence/services/BackendPythonModulesClient.js";
import { DocumentArchiveService } from "../../modules/document-archive/services/DocumentArchiveService.js";
import { AuthModule } from "../auth/auth.module.js";
import { DocumentArchiveNestModule } from "../document-archive/document-archive.module.js";
import { NestKnowledgeController } from "./knowledge.controller.js";

@Module({
  imports: [AuthModule, DocumentArchiveNestModule],
  controllers: [NestKnowledgeController],
  providers: [
    {
      provide: DocumentIntelligenceService,
      useFactory: (
        documentArchiveService: DocumentArchiveService,
        pythonModulesClient: BackendPythonModulesClient,
      ) => new DocumentIntelligenceService(documentArchiveService, undefined, pythonModulesClient),
      inject: [DocumentArchiveService, BackendPythonModulesClient],
    },
  ],
  exports: [DocumentIntelligenceService],
})
export class KnowledgeNestModule {}
