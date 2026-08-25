import { Global, Module } from "@nestjs/common";

import { WorkspaceMembershipPrismaReader } from "../../database/WorkspaceMembershipPrismaReader.js";
import { WorkspacePermissionPrismaReader } from "../../database/WorkspacePermissionPrismaReader.js";
import { OpenAiCompatibleToolChatClient } from "../../modules/ai-runtime/services/OpenAiCompatibleToolChatClient.js";
import { PrismaModuleAgentRepository } from "../../modules/agents/infra/PrismaModuleAgentRepository.js";
import { PrismaAuditLogRepository } from "../../modules/audit/infra/PrismaAuditLogRepository.js";
import { PrismaClientRepository } from "../../modules/clients/infra/PrismaClientRepository.js";
import { PrismaCompanyRepository } from "../../modules/companies/infra/PrismaCompanyRepository.js";
import { PrismaAssistantSessionRepository } from "../../modules/conversational-assistant/infra/PrismaAssistantSessionRepository.js";
import { PrismaDocumentArchiveRepository } from "../../modules/document-archive/infra/PrismaDocumentArchiveRepository.js";
import { PrismaAuthLoginChallengeRepository } from "../../modules/identity/infra/PrismaAuthLoginChallengeRepository.js";
import { PrismaAuthSessionRepository } from "../../modules/identity/infra/PrismaAuthSessionRepository.js";
import { PrismaPasswordResetCodeRepository } from "../../modules/identity/infra/PrismaPasswordResetCodeRepository.js";
import { PrismaUserAccountRepository } from "../../modules/identity/infra/PrismaUserAccountRepository.js";
import { PrismaModuleAccessRepository } from "../../modules/module-management/infra/PrismaModuleAccessRepository.js";
import { PrismaNotificationRepository } from "../../modules/notifications/infra/PrismaNotificationRepository.js";
import { PrismaUserPreferenceRepository } from "../../modules/preferences/infra/PrismaUserPreferenceRepository.js";
import { PrismaProjectAuthorRepository } from "../../modules/project-authors/infra/PrismaProjectAuthorRepository.js";
import { PrismaProjectRevisionRepository } from "../../modules/project-revisions/infra/PrismaProjectRevisionRepository.js";
import { PrismaProjectRepository } from "../../modules/projects/infra/PrismaProjectRepository.js";
import { PrismaQuotationOrchestratorRepository } from "../../modules/quotation-orchestrator/infra/PrismaQuotationOrchestratorRepository.js";
import { PrismaShipmentRepository } from "../../modules/shipping/infra/PrismaShipmentRepository.js";
import { PrismaWorkflowRepository } from "../../modules/workflows/infra/PrismaWorkflowRepository.js";

const PROVIDERS = [
  WorkspaceMembershipPrismaReader,
  WorkspacePermissionPrismaReader,
  PrismaModuleAgentRepository,
  PrismaAuditLogRepository,
  PrismaClientRepository,
  PrismaCompanyRepository,
  PrismaAssistantSessionRepository,
  OpenAiCompatibleToolChatClient,
  PrismaDocumentArchiveRepository,
  PrismaAuthLoginChallengeRepository,
  PrismaAuthSessionRepository,
  PrismaPasswordResetCodeRepository,
  PrismaUserAccountRepository,
  PrismaModuleAccessRepository,
  PrismaNotificationRepository,
  PrismaUserPreferenceRepository,
  PrismaProjectAuthorRepository,
  PrismaProjectRevisionRepository,
  PrismaProjectRepository,
  PrismaQuotationOrchestratorRepository,
  PrismaShipmentRepository,
  PrismaWorkflowRepository,
] as const;

@Global()
@Module({
  providers: [...PROVIDERS],
  exports: [...PROVIDERS],
})
export class BackendProvidersModule {}
