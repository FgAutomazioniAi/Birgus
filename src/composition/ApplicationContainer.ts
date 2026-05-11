import { PermissionPolicy } from "../core/authorization/PermissionPolicy.js";
import { ModuleAccessPolicy } from "../core/module-access/ModuleAccessPolicy.js";
import { TenancyGuard } from "../core/tenancy/TenancyGuard.js";
import { WorkspaceMembershipPrismaReader } from "../database/WorkspaceMembershipPrismaReader.js";
import { WorkspacePermissionPrismaReader } from "../database/WorkspacePermissionPrismaReader.js";
import { PrismaClientRepository } from "../modules/clients/infra/PrismaClientRepository.js";
import { ClientService } from "../modules/clients/services/ClientService.js";
import { PrismaModuleAgentRepository } from "../modules/agents/infra/PrismaModuleAgentRepository.js";
import { ModuleAgentService } from "../modules/agents/services/ModuleAgentService.js";
import { PrismaAssistantSessionRepository } from "../modules/conversational-assistant/infra/PrismaAssistantSessionRepository.js";
import { AssistantConversationService } from "../modules/conversational-assistant/services/AssistantConversationService.js";
import { AssistantSessionService } from "../modules/conversational-assistant/services/AssistantSessionService.js";
import { AssistantToolAccessService } from "../modules/conversational-assistant/services/AssistantToolAccessService.js";
import { AssistantToolRegistry } from "../modules/conversational-assistant/services/AssistantToolRegistry.js";
import { PrismaDdtProcessingRepository } from "../modules/ddt-processing/infra/PrismaDdtProcessingRepository.js";
import { DdtProcessingService } from "../modules/ddt-processing/services/DdtProcessingService.js";
import { LegacyDdtReaderService } from "../modules/ddt-processing/services/LegacyDdtReaderService.js";
import { NextOrchestratorDdtAnalyzer } from "../modules/ddt-processing/services/NextOrchestratorDdtAnalyzer.js";
import { PrismaDocumentArchiveRepository } from "../modules/document-archive/infra/PrismaDocumentArchiveRepository.js";
import { DocumentArchiveService } from "../modules/document-archive/services/DocumentArchiveService.js";
import { DocumentIntelligenceService } from "../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { PrismaAuthSessionRepository } from "../modules/identity/infra/PrismaAuthSessionRepository.js";
import { PrismaPasswordResetCodeRepository } from "../modules/identity/infra/PrismaPasswordResetCodeRepository.js";
import { PrismaUserAccountRepository } from "../modules/identity/infra/PrismaUserAccountRepository.js";
import { AuthService } from "../modules/identity/services/AuthService.js";
import { PasswordResetService } from "../modules/identity/services/PasswordResetService.js";
import { PasswordHasher } from "../modules/identity/services/PasswordHasher.js";
import { SessionTokenService } from "../modules/identity/services/SessionTokenService.js";
import { SmtpPasswordResetNotifier } from "../modules/identity/services/SmtpPasswordResetNotifier.js";
import { PrismaModuleAccessRepository } from "../modules/module-management/infra/PrismaModuleAccessRepository.js";
import { ModuleManagementService } from "../modules/module-management/services/ModuleManagementService.js";
import { PrismaNotificationRepository } from "../modules/notifications/infra/PrismaNotificationRepository.js";
import { NotificationService } from "../modules/notifications/services/NotificationService.js";
import { PrismaProjectRepository } from "../modules/projects/infra/PrismaProjectRepository.js";
import { ProjectService } from "../modules/projects/services/ProjectService.js";
import { LegacyQuotationOrchestratorService } from "../modules/quotation-orchestrator/services/LegacyQuotationOrchestratorService.js";
import { NextOrchestratorQuotationAnalyzer } from "../modules/quotation-orchestrator/services/NextOrchestratorQuotationAnalyzer.js";
import { PrismaQuotationOrchestratorRepository } from "../modules/quotation-orchestrator/infra/PrismaQuotationOrchestratorRepository.js";
import { QuotationDocxBuilder } from "../modules/quotation-orchestrator/services/QuotationDocxBuilder.js";
import { SmtpQuotationEmailNotifier } from "../modules/quotation-orchestrator/services/SmtpQuotationEmailNotifier.js";
import { PrismaUserPreferenceRepository } from "../modules/preferences/infra/PrismaUserPreferenceRepository.js";
import { UserPreferenceService } from "../modules/preferences/services/UserPreferenceService.js";
import { PrismaShipmentRepository } from "../modules/shipping/infra/PrismaShipmentRepository.js";
import { ShipmentService } from "../modules/shipping/services/ShipmentService.js";
import { StorageSelector } from "../storage/StorageSelector.js";
import { InMemoryJobQueue } from "../worker/queue/InMemoryJobQueue.js";
import { DdtProcessingWorker } from "../worker/services/DdtProcessingWorker.js";
import { WorkerCoordinator } from "../worker/services/WorkerCoordinator.js";

export class ApplicationContainer {
  public readonly tenancyGuard: TenancyGuard;
  public readonly moduleAccessPolicy: ModuleAccessPolicy;
  public readonly permissionPolicy: PermissionPolicy;
  public readonly authService: AuthService;
  public readonly passwordResetService: PasswordResetService;
  public readonly moduleManagementService: ModuleManagementService;
  public readonly clientService: ClientService;
  public readonly moduleAgentService: ModuleAgentService;
  public readonly userPreferenceService: UserPreferenceService;
  public readonly projectService: ProjectService;
  public readonly documentArchiveService: DocumentArchiveService;
  public readonly documentIntelligenceService: DocumentIntelligenceService;
  public readonly shipmentService: ShipmentService;
  public readonly ddtProcessingService: DdtProcessingService;
  public readonly legacyDdtReaderService: LegacyDdtReaderService;
  public readonly legacyQuotationOrchestratorService: LegacyQuotationOrchestratorService;
  public readonly assistantSessionService: AssistantSessionService;
  public readonly assistantConversationService: AssistantConversationService;
  public readonly notificationService: NotificationService;
  public readonly workerCoordinator: WorkerCoordinator;

  public constructor() {
    const membershipReader = new WorkspaceMembershipPrismaReader();
    const permissionReader = new WorkspacePermissionPrismaReader();
    const moduleAccessRepository = new PrismaModuleAccessRepository();

    this.tenancyGuard = new TenancyGuard(membershipReader);
    this.moduleAccessPolicy = new ModuleAccessPolicy(moduleAccessRepository);
    this.permissionPolicy = new PermissionPolicy(permissionReader);

    const userRepository = new PrismaUserAccountRepository();
    const authSessionRepository = new PrismaAuthSessionRepository();
    const passwordHasher = new PasswordHasher(process.env.AUTH_PEPPER ?? "");
    const tokenService = new SessionTokenService();

    this.authService = new AuthService(
      userRepository,
      authSessionRepository,
      passwordHasher,
      tokenService,
      Number.parseInt(process.env.AUTH_SESSION_HOURS ?? "12", 10),
      Number.parseInt(process.env.AUTH_SESSION_REMEMBER_DAYS ?? "30", 10),
    );

    this.passwordResetService = new PasswordResetService(
      userRepository,
      new PrismaPasswordResetCodeRepository(),
      authSessionRepository,
      passwordHasher,
      new SmtpPasswordResetNotifier(),
      Number.parseInt(process.env.AUTH_PASSWORD_RESET_CODE_TTL_MINUTES ?? "15", 10),
    );

    this.moduleManagementService = new ModuleManagementService(moduleAccessRepository);

    const clientRepository = new PrismaClientRepository();
    this.clientService = new ClientService(clientRepository);

    const moduleAgentRepository = new PrismaModuleAgentRepository();
    this.moduleAgentService = new ModuleAgentService(moduleAgentRepository);

    const userPreferenceRepository = new PrismaUserPreferenceRepository();
    this.userPreferenceService = new UserPreferenceService(userPreferenceRepository);

    const shipmentRepository = new PrismaShipmentRepository();
    this.shipmentService = new ShipmentService(shipmentRepository);

    const projectRepository = new PrismaProjectRepository();
    this.projectService = new ProjectService(projectRepository, this.shipmentService);

    const storage = StorageSelector.create();
    const documentRepository = new PrismaDocumentArchiveRepository();
    this.documentArchiveService = new DocumentArchiveService(documentRepository, storage);
    this.documentIntelligenceService = new DocumentIntelligenceService(this.documentArchiveService);

    const queue = new InMemoryJobQueue();
    const ddtRepository = new PrismaDdtProcessingRepository();
    this.ddtProcessingService = new DdtProcessingService(ddtRepository, queue);
    this.legacyDdtReaderService = new LegacyDdtReaderService(this.ddtProcessingService, storage);
    this.legacyQuotationOrchestratorService = new LegacyQuotationOrchestratorService(
      this.documentArchiveService,
      new NextOrchestratorQuotationAnalyzer(this.moduleAgentService),
      new QuotationDocxBuilder(),
      new PrismaQuotationOrchestratorRepository(),
      new SmtpQuotationEmailNotifier(),
      this.documentIntelligenceService,
    );

    const ddtWorker = new DdtProcessingWorker(
      ddtRepository,
      new NextOrchestratorDdtAnalyzer(this.moduleAgentService),
      this.documentIntelligenceService,
    );
    this.workerCoordinator = new WorkerCoordinator(queue, ddtWorker);
    this.workerCoordinator.registerHandlers();
    void this.ddtProcessingService.resumePendingJobs().catch((error) => {
      console.error("[ApplicationContainer] Unable to resume pending DDT jobs", error);
    });
    void this.legacyQuotationOrchestratorService.resumePendingJobs().catch((error) => {
      console.error("[ApplicationContainer] Unable to resume pending quotation jobs", error);
    });

    const assistantSessionRepository = new PrismaAssistantSessionRepository();
    this.assistantSessionService = new AssistantSessionService(assistantSessionRepository);
    const assistantToolRegistry = new AssistantToolRegistry(
      this.projectService,
      this.shipmentService,
      this.documentIntelligenceService,
    );
    const assistantToolAccessService = new AssistantToolAccessService(
      this.moduleAccessPolicy,
      this.permissionPolicy,
    );
    this.assistantConversationService = new AssistantConversationService({
      sessionService: this.assistantSessionService,
      toolRegistry: assistantToolRegistry,
      toolAccessService: assistantToolAccessService,
      documentIntelligenceService: this.documentIntelligenceService,
      repository: assistantSessionRepository,
    });

    const notificationRepository = new PrismaNotificationRepository();
    this.notificationService = new NotificationService(notificationRepository);
  }
}
