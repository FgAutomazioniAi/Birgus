import { PermissionPolicy } from "../core/authorization/PermissionPolicy.js";
import { ModuleAccessPolicy } from "../core/module-access/ModuleAccessPolicy.js";
import { TenancyGuard } from "../core/tenancy/TenancyGuard.js";
import { WorkspaceMembershipPrismaReader } from "../database/WorkspaceMembershipPrismaReader.js";
import { WorkspacePermissionPrismaReader } from "../database/WorkspacePermissionPrismaReader.js";
import { PrismaClientRepository } from "../modules/clients/infra/PrismaClientRepository.js";
import { ClientService } from "../modules/clients/services/ClientService.js";
import { PrismaDdtProcessingRepository } from "../modules/ddt-processing/infra/PrismaDdtProcessingRepository.js";
import { DdtProcessingService } from "../modules/ddt-processing/services/DdtProcessingService.js";
import { LegacyDdtReaderService } from "../modules/ddt-processing/services/LegacyDdtReaderService.js";
import { StubDdtAnalyzer } from "../modules/ddt-processing/services/StubDdtAnalyzer.js";
import { PrismaDocumentArchiveRepository } from "../modules/document-archive/infra/PrismaDocumentArchiveRepository.js";
import { DocumentArchiveService } from "../modules/document-archive/services/DocumentArchiveService.js";
import { PrismaAuthSessionRepository } from "../modules/identity/infra/PrismaAuthSessionRepository.js";
import { PrismaPasswordResetCodeRepository } from "../modules/identity/infra/PrismaPasswordResetCodeRepository.js";
import { PrismaUserAccountRepository } from "../modules/identity/infra/PrismaUserAccountRepository.js";
import { AuthService } from "../modules/identity/services/AuthService.js";
import { PasswordResetService } from "../modules/identity/services/PasswordResetService.js";
import { PasswordHasher } from "../modules/identity/services/PasswordHasher.js";
import { SessionTokenService } from "../modules/identity/services/SessionTokenService.js";
import { PrismaModuleAccessRepository } from "../modules/module-management/infra/PrismaModuleAccessRepository.js";
import { ModuleManagementService } from "../modules/module-management/services/ModuleManagementService.js";
import { PrismaNotificationRepository } from "../modules/notifications/infra/PrismaNotificationRepository.js";
import { NotificationService } from "../modules/notifications/services/NotificationService.js";
import { PrismaProjectRepository } from "../modules/projects/infra/PrismaProjectRepository.js";
import { ProjectService } from "../modules/projects/services/ProjectService.js";
import { LegacyQuotationOrchestratorService } from "../modules/quotation-orchestrator/services/LegacyQuotationOrchestratorService.js";
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
  public readonly userPreferenceService: UserPreferenceService;
  public readonly projectService: ProjectService;
  public readonly documentArchiveService: DocumentArchiveService;
  public readonly shipmentService: ShipmentService;
  public readonly ddtProcessingService: DdtProcessingService;
  public readonly legacyDdtReaderService: LegacyDdtReaderService;
  public readonly legacyQuotationOrchestratorService: LegacyQuotationOrchestratorService;
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
      Number.parseInt(process.env.AUTH_PASSWORD_RESET_CODE_TTL_MINUTES ?? "15", 10),
    );

    this.moduleManagementService = new ModuleManagementService(moduleAccessRepository);

    const clientRepository = new PrismaClientRepository();
    this.clientService = new ClientService(clientRepository);

    const userPreferenceRepository = new PrismaUserPreferenceRepository();
    this.userPreferenceService = new UserPreferenceService(userPreferenceRepository);

    const projectRepository = new PrismaProjectRepository();
    this.projectService = new ProjectService(projectRepository);

    const storage = StorageSelector.create();
    const documentRepository = new PrismaDocumentArchiveRepository();
    this.documentArchiveService = new DocumentArchiveService(documentRepository, storage);

    const shipmentRepository = new PrismaShipmentRepository();
    this.shipmentService = new ShipmentService(shipmentRepository);

    const queue = new InMemoryJobQueue();
    const ddtRepository = new PrismaDdtProcessingRepository();
    this.ddtProcessingService = new DdtProcessingService(ddtRepository, queue);
    this.legacyDdtReaderService = new LegacyDdtReaderService(this.ddtProcessingService, storage);
    this.legacyQuotationOrchestratorService = new LegacyQuotationOrchestratorService(this.documentArchiveService);

    const ddtWorker = new DdtProcessingWorker(ddtRepository, new StubDdtAnalyzer());
    this.workerCoordinator = new WorkerCoordinator(queue, ddtWorker);
    this.workerCoordinator.registerHandlers();

    const notificationRepository = new PrismaNotificationRepository();
    this.notificationService = new NotificationService(notificationRepository);
  }
}
