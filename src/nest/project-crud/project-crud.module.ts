import { Module } from "@nestjs/common";

import { AuditLogService } from "../../modules/audit/services/AuditLogService.js";
import { PrismaClientRepository } from "../../modules/clients/infra/PrismaClientRepository.js";
import { ClientService } from "../../modules/clients/services/ClientService.js";
import { PrismaCompanyRepository } from "../../modules/companies/infra/PrismaCompanyRepository.js";
import { CompanyService } from "../../modules/companies/services/CompanyService.js";
import { PrismaProjectAuthorRepository } from "../../modules/project-authors/infra/PrismaProjectAuthorRepository.js";
import { ProjectAuthorService } from "../../modules/project-authors/services/ProjectAuthorService.js";
import { PrismaProjectRevisionRepository } from "../../modules/project-revisions/infra/PrismaProjectRevisionRepository.js";
import { ProjectRevisionService } from "../../modules/project-revisions/services/ProjectRevisionService.js";
import { AuditNestModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { NestProjectCrudController } from "./project-crud.controller.js";

@Module({
  imports: [AuthModule, AuditNestModule],
  controllers: [NestProjectCrudController],
  providers: [
    {
      provide: CompanyService,
      useFactory: (
        repository: PrismaCompanyRepository,
        auditLogService: AuditLogService,
      ) => new CompanyService(repository, auditLogService),
      inject: [PrismaCompanyRepository, AuditLogService],
    },
    {
      provide: ClientService,
      useFactory: (
        repository: PrismaClientRepository,
        auditLogService: AuditLogService,
      ) => new ClientService(repository, auditLogService),
      inject: [PrismaClientRepository, AuditLogService],
    },
    {
      provide: ProjectAuthorService,
      useFactory: (
        repository: PrismaProjectAuthorRepository,
        auditLogService: AuditLogService,
      ) => new ProjectAuthorService(repository, auditLogService),
      inject: [PrismaProjectAuthorRepository, AuditLogService],
    },
    {
      provide: ProjectRevisionService,
      useFactory: (
        repository: PrismaProjectRevisionRepository,
        auditLogService: AuditLogService,
      ) => new ProjectRevisionService(repository, auditLogService),
      inject: [PrismaProjectRevisionRepository, AuditLogService],
    },
  ],
})
export class ProjectCrudNestModule {}
