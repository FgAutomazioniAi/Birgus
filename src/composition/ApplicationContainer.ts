import { PermissionPolicy } from "../core/authorization/PermissionPolicy.js";
import { ModuleAccessPolicy } from "../core/module-access/ModuleAccessPolicy.js";
import { TenancyGuard } from "../core/tenancy/TenancyGuard.js";
import { WorkspaceMembershipPrismaReader } from "../database/WorkspaceMembershipPrismaReader.js";
import { WorkspacePermissionPrismaReader } from "../database/WorkspacePermissionPrismaReader.js";
import { PrismaClientRepository } from "../modules/clients/infra/PrismaClientRepository.js";
import { ClientService } from "../modules/clients/services/ClientService.js";
import { PrismaCompanyRepository } from "../modules/companies/infra/PrismaCompanyRepository.js";
import { CompanyService } from "../modules/companies/services/CompanyService.js";
import { PrismaModuleAgentRepository } from "../modules/agents/infra/PrismaModuleAgentRepository.js";
import { ModuleAgentService } from "../modules/agents/services/ModuleAgentService.js";
import { PrismaAuditLogRepository } from "../modules/audit/infra/PrismaAuditLogRepository.js";
import { AuditLogService } from "../modules/audit/services/AuditLogService.js";
import { PrismaAssistantSessionRepository } from "../modules/conversational-assistant/infra/PrismaAssistantSessionRepository.js";
import { AssistantConversationService } from "../modules/conversational-assistant/services/AssistantConversationService.js";
import { AssistantSessionService } from "../modules/conversational-assistant/services/AssistantSessionService.js";
import { AssistantToolAccessService } from "../modules/conversational-assistant/services/AssistantToolAccessService.js";
import { AssistantToolRegistry } from "../modules/conversational-assistant/services/AssistantToolRegistry.js";
import { PrismaDdtProcessingRepository } from "../modules/ddt-processing/infra/PrismaDdtProcessingRepository.js";
import { DdtProcessingService } from "../modules/ddt-processing/services/DdtProcessingService.js";
import { DdtReaderService } from "../modules/ddt-processing/services/DdtReaderService.js";
import { NextOrchestratorDdtAnalyzer } from "../modules/ddt-processing/services/NextOrchestratorDdtAnalyzer.js";
import { PrismaDocumentArchiveRepository } from "../modules/document-archive/infra/PrismaDocumentArchiveRepository.js";
import { ArchivedItemsService } from "../modules/document-archive/services/ArchivedItemsService.js";
import { DocumentArchiveService } from "../modules/document-archive/services/DocumentArchiveService.js";
import { DocumentIntelligenceService } from "../modules/document-intelligence/services/DocumentIntelligenceService.js";
import { BackendPythonModulesClient } from "../modules/document-intelligence/services/BackendPythonModulesClient.js";
import { PrismaAuthSessionRepository } from "../modules/identity/infra/PrismaAuthSessionRepository.js";
import { PrismaAuthLoginChallengeRepository } from "../modules/identity/infra/PrismaAuthLoginChallengeRepository.js";
import { PrismaPasswordResetCodeRepository } from "../modules/identity/infra/PrismaPasswordResetCodeRepository.js";
import { PrismaUserAccountRepository } from "../modules/identity/infra/PrismaUserAccountRepository.js";
import { AuthService } from "../modules/identity/services/AuthService.js";
import { PasswordResetService } from "../modules/identity/services/PasswordResetService.js";
import { PasswordHasher } from "../modules/identity/services/PasswordHasher.js";
import { SessionTokenService } from "../modules/identity/services/SessionTokenService.js";
import { SmtpPasswordResetNotifier } from "../modules/identity/services/SmtpPasswordResetNotifier.js";
import { TotpSecretCipherService } from "../modules/identity/services/TotpSecretCipherService.js";
import { TotpService } from "../modules/identity/services/TotpService.js";
import { PrismaModuleAccessRepository } from "../modules/module-management/infra/PrismaModuleAccessRepository.js";
import { ModuleManagementService } from "../modules/module-management/services/ModuleManagementService.js";
import { PrismaNotificationRepository } from "../modules/notifications/infra/PrismaNotificationRepository.js";
import { NotificationService } from "../modules/notifications/services/NotificationService.js";
import { PrismaProjectAuthorRepository } from "../modules/project-authors/infra/PrismaProjectAuthorRepository.js";
import { ProjectAuthorService } from "../modules/project-authors/services/ProjectAuthorService.js";
import { PrismaProjectRepository } from "../modules/projects/infra/PrismaProjectRepository.js";
import { ProjectService } from "../modules/projects/services/ProjectService.js";
import { PrismaProjectRevisionRepository } from "../modules/project-revisions/infra/PrismaProjectRevisionRepository.js";
import { ProjectRevisionService } from "../modules/project-revisions/services/ProjectRevisionService.js";
import { QuotationOrchestratorService } from "../modules/quotation-orchestrator/services/QuotationOrchestratorService.js";
import { NextOrchestratorQuotationAnalyzer } from "../modules/quotation-orchestrator/services/NextOrchestratorQuotationAnalyzer.js";
import { PrismaQuotationOrchestratorRepository } from "../modules/quotation-orchestrator/infra/PrismaQuotationOrchestratorRepository.js";
import { PythonQuotationEmailNotifier } from "../modules/quotation-orchestrator/services/PythonQuotationEmailNotifier.js";
import { QuotationDocxBuilder } from "../modules/quotation-orchestrator/services/QuotationDocxBuilder.js";
import { PrismaUserPreferenceRepository } from "../modules/preferences/infra/PrismaUserPreferenceRepository.js";
import { UserPreferenceService } from "../modules/preferences/services/UserPreferenceService.js";
import { PrismaShipmentRepository } from "../modules/shipping/infra/PrismaShipmentRepository.js";
import { ShipmentService } from "../modules/shipping/services/ShipmentService.js";
import { StorageSelector } from "../storage/StorageSelector.js";
import { InMemoryJobQueue } from "../worker/queue/InMemoryJobQueue.js";
import { DdtProcessingWorker } from "../worker/services/DdtProcessingWorker.js";
import { WorkerCoordinator } from "../worker/services/WorkerCoordinator.js";
import { PrismaWorkflowRepository } from "../modules/workflows/infra/PrismaWorkflowRepository.js";
import { QueueWorkflowRunDispatcher } from "../modules/workflows/services/QueueWorkflowRunDispatcher.js";
import { WorkflowService } from "../modules/workflows/services/WorkflowService.js";
import { WorkflowRunExecutorService } from "../modules/workflows/services/WorkflowRunExecutorService.js";
import { WorkflowRunWorker } from "../worker/services/WorkflowRunWorker.js";
import { SuperadminService } from "../modules/superadmin/services/SuperadminService.js";

export class ApplicationContainer {
  public readonly tenancyGuard: TenancyGuard;
  public readonly moduleAccessPolicy: ModuleAccessPolicy;
  public readonly permissionPolicy: PermissionPolicy;
  public readonly authService: AuthService;
  public readonly passwordResetService: PasswordResetService;
  public readonly moduleManagementService: ModuleManagementService;
  public readonly auditLogService: AuditLogService;
  public readonly companyService: CompanyService;
  public readonly clientService: ClientService;
  public readonly moduleAgentService: ModuleAgentService;
  public readonly userPreferenceService: UserPreferenceService;
  public readonly projectAuthorService: ProjectAuthorService;
  public readonly projectService: ProjectService;
  public readonly projectRevisionService: ProjectRevisionService;
  public readonly documentArchiveService: DocumentArchiveService;
  public readonly archivedItemsService: ArchivedItemsService;
  public readonly documentIntelligenceService: DocumentIntelligenceService;
  public readonly shipmentService: ShipmentService;
  public readonly ddtProcessingService: DdtProcessingService;
  public readonly ddtReaderService: DdtReaderService;
  public readonly quotationOrchestratorService: QuotationOrchestratorService;
  public readonly assistantSessionService: AssistantSessionService;
  public readonly assistantConversationService: AssistantConversationService;
  public readonly notificationService: NotificationService;
  public readonly workflowService: WorkflowService;
  public readonly superadminService: SuperadminService;
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
    const authLoginChallengeRepository = new PrismaAuthLoginChallengeRepository();
    const passwordHasher = new PasswordHasher(process.env.AUTH_PEPPER ?? "");
    const tokenService = new SessionTokenService();
    const totpService = new TotpService(
      Number.parseInt(process.env.AUTH_TOTP_DIGITS ?? "6", 10),
      Number.parseInt(process.env.AUTH_TOTP_STEP_SECONDS ?? "30", 10),
    );
    const totpSecretCipherService = new TotpSecretCipherService(
      process.env.AUTH_TOTP_ENCRYPTION_KEY ?? process.env.AUTH_PEPPER ?? "",
    );

    this.authService = new AuthService(
      userRepository,
      authSessionRepository,
      authLoginChallengeRepository,
      passwordHasher,
      tokenService,
      totpService,
      totpSecretCipherService,
      process.env.AUTH_TOTP_ISSUER ?? "Birgus",
      Number.parseInt(process.env.AUTH_SESSION_HOURS ?? "12", 10),
      Number.parseInt(process.env.AUTH_SESSION_REMEMBER_DAYS ?? "30", 10),
      Number.parseInt(process.env.AUTH_2FA_CHALLENGE_TTL_MINUTES ?? "5", 10),
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
    this.auditLogService = new AuditLogService(new PrismaAuditLogRepository());

    const notificationRepository = new PrismaNotificationRepository();
    this.notificationService = new NotificationService(notificationRepository);

    const companyRepository = new PrismaCompanyRepository();
    this.companyService = new CompanyService(companyRepository, this.auditLogService);

    const clientRepository = new PrismaClientRepository();
    this.clientService = new ClientService(clientRepository, this.auditLogService);

    const moduleAgentRepository = new PrismaModuleAgentRepository();
    this.moduleAgentService = new ModuleAgentService(moduleAgentRepository);

    const userPreferenceRepository = new PrismaUserPreferenceRepository();
    this.userPreferenceService = new UserPreferenceService(userPreferenceRepository);

    const shipmentRepository = new PrismaShipmentRepository();
    this.shipmentService = new ShipmentService(shipmentRepository, this.notificationService);

    const projectAuthorRepository = new PrismaProjectAuthorRepository();
    this.projectAuthorService = new ProjectAuthorService(projectAuthorRepository, this.auditLogService);

    const projectRevisionRepository = new PrismaProjectRevisionRepository();
    this.projectRevisionService = new ProjectRevisionService(projectRevisionRepository, this.auditLogService);

    const projectRepository = new PrismaProjectRepository();
    this.projectService = new ProjectService(
      projectRepository,
      this.shipmentService,
      this.notificationService,
      this.auditLogService,
    );

    const storage = StorageSelector.create();
    const documentRepository = new PrismaDocumentArchiveRepository();
    this.documentArchiveService = new DocumentArchiveService(documentRepository, storage);
    this.archivedItemsService = new ArchivedItemsService(storage);
    this.documentIntelligenceService = new DocumentIntelligenceService(this.documentArchiveService);
    const queue = new InMemoryJobQueue();
    const workflowRunDispatcher = new QueueWorkflowRunDispatcher(queue);
    const nextOrchestratorQuotationAnalyzer = new NextOrchestratorQuotationAnalyzer(this.moduleAgentService);
    const nextOrchestratorDdtAnalyzer = new NextOrchestratorDdtAnalyzer(this.moduleAgentService);
    const workflowRunExecutorService = new WorkflowRunExecutorService({
      documentArchiveService: this.documentArchiveService,
      documentIntelligenceService: this.documentIntelligenceService,
      quotationAnalyzer: nextOrchestratorQuotationAnalyzer,
      ddtAnalyzer: nextOrchestratorDdtAnalyzer,
      pythonModulesClient: new BackendPythonModulesClient(),
      notificationService: this.notificationService,
    });
    this.workflowService = new WorkflowService(new PrismaWorkflowRepository(), workflowRunDispatcher);
    this.superadminService = new SuperadminService({
      archivedItemsService: this.archivedItemsService,
      passwordHasher,
      authSessionRepository,
      moduleManagementService: this.moduleManagementService,
      auditLogService: this.auditLogService,
    });

    const ddtRepository = new PrismaDdtProcessingRepository();
    this.ddtProcessingService = new DdtProcessingService(ddtRepository, queue);
    this.ddtReaderService = new DdtReaderService(storage, this.workflowService, this.notificationService);
    this.quotationOrchestratorService = new QuotationOrchestratorService(
      this.documentArchiveService,
      nextOrchestratorQuotationAnalyzer,
      new QuotationDocxBuilder(),
      new PrismaQuotationOrchestratorRepository(),
      new PythonQuotationEmailNotifier(),
      this.documentIntelligenceService,
      this.workflowService,
      this.notificationService,
    );

    const ddtWorker = new DdtProcessingWorker(
      ddtRepository,
      nextOrchestratorDdtAnalyzer,
      this.documentIntelligenceService,
      this.notificationService,
    );
    const workflowRunWorker = new WorkflowRunWorker(workflowRunExecutorService);
    this.workerCoordinator = new WorkerCoordinator(queue, ddtWorker, workflowRunWorker);
    this.workerCoordinator.registerHandlers();
    void this.ddtProcessingService.resumePendingJobs().catch((error) => {
      console.error("[ApplicationContainer] Unable to resume pending DDT jobs", error);
    });
    void this.quotationOrchestratorService.resumePendingJobs().catch((error) => {
      console.error("[ApplicationContainer] Unable to resume pending quotation jobs", error);
    });
    void workflowRunExecutorService.resumeRecoverableRuns().catch((error) => {
      console.error("[ApplicationContainer] Unable to resume pending workflow runs", error);
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
  }
}
