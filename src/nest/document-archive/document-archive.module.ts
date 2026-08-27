import { Module } from "@nestjs/common";

import { PrismaDocumentArchiveRepository } from "../../modules/document-archive/infra/PrismaDocumentArchiveRepository.js";
import { ArchivedItemsService } from "../../modules/document-archive/services/ArchivedItemsService.js";
import { ActiveDocumentsService } from "../../modules/document-archive/services/ActiveDocumentsService.js";
import { DocumentArchiveService } from "../../modules/document-archive/services/DocumentArchiveService.js";
import { ProjectBinaryStorage } from "../../storage/ProjectBinaryStorage.js";
import { AuthModule } from "../auth/auth.module.js";
import { PROJECT_BINARY_STORAGE } from "../common/tokens.js";
import { NestDocumentArchiveController } from "./document-archive.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [NestDocumentArchiveController],
  providers: [
    {
      provide: DocumentArchiveService,
      useFactory: (
        repository: PrismaDocumentArchiveRepository,
        storage: ProjectBinaryStorage,
      ) => new DocumentArchiveService(repository, storage),
      inject: [PrismaDocumentArchiveRepository, PROJECT_BINARY_STORAGE],
    },
    {
      provide: ArchivedItemsService,
      useFactory: (storage: ProjectBinaryStorage) => new ArchivedItemsService(storage),
      inject: [PROJECT_BINARY_STORAGE],
    },
    ActiveDocumentsService,
  ],
  exports: [DocumentArchiveService, ArchivedItemsService, ActiveDocumentsService],
})
export class DocumentArchiveNestModule {}
