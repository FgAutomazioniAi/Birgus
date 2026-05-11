import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";

import { ApplicationContainer } from "../composition/ApplicationContainer.js";
import { AppError } from "../core/errors/AppError.js";
import { ModuleGuard } from "./middleware/ModuleGuard.js";
import { AuthMiddleware } from "./middleware/AuthMiddleware.js";
import { PermissionGuard } from "./middleware/PermissionGuard.js";
import { AuthController } from "./controllers/AuthController.js";
import { AssistantController } from "./controllers/AssistantController.js";
import { SessionCookieFactory } from "./auth/SessionCookieFactory.js";
import { ClientController } from "./controllers/ClientController.js";
import { DdtController } from "./controllers/DdtController.js";
import { KnowledgeController } from "./controllers/KnowledgeController.js";
import { LegacyDdtReaderController } from "./controllers/LegacyDdtReaderController.js";
import { LegacyOrchestratorController } from "./controllers/LegacyOrchestratorController.js";
import { LegacyProjectAssetsController } from "./controllers/LegacyProjectAssetsController.js";
import { ModuleController } from "./controllers/ModuleController.js";
import { NotificationController } from "./controllers/NotificationController.js";
import { ProjectAgentController } from "./controllers/ProjectAgentController.js";
import { ProjectController } from "./controllers/ProjectController.js";
import { ShipmentController } from "./controllers/ShipmentController.js";
import { UserPreferenceController } from "./controllers/UserPreferenceController.js";

const healthSchema = z.object({
  ok: z.literal(true),
  timestamp: z.string(),
});

export class HttpServer {
  private readonly app = Fastify({
    logger: true,
    trustProxy: this.resolveTrustProxy(),
  });
  private readonly container: ApplicationContainer;
  private readonly authMiddleware: AuthMiddleware;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(container?: ApplicationContainer) {
    this.container = container ?? new ApplicationContainer();
    this.authMiddleware = new AuthMiddleware(
      this.container.authService,
      this.container.tenancyGuard,
      process.env.AUTH_COOKIE_NAME ?? "vl_session",
    );
    this.moduleGuard = new ModuleGuard(this.container.moduleAccessPolicy);
    this.permissionGuard = new PermissionGuard(this.container.permissionPolicy);

    this.registerPlugins();
    this.registerRoutes();
    this.registerErrorHandler();
  }

  public async start(port = 3000, host = "0.0.0.0"): Promise<void> {
    await this.app.listen({ port, host });
    this.app.log.info(`HTTP server listening on ${host}:${port}`);
  }

  private registerPlugins(): void {
    this.app.register(multipart, {
      throwFileSizeLimit: true,
    });
  }

  private registerRoutes(): void {
    const sessionCookieFactory = new SessionCookieFactory({
      cookieName: process.env.AUTH_COOKIE_NAME ?? "vl_session",
      domain: process.env.AUTH_COOKIE_DOMAIN,
      path: process.env.AUTH_COOKIE_PATH ?? "/",
      secure: this.resolveBooleanEnv("AUTH_COOKIE_SECURE", false),
      sameSite: this.resolveSameSiteMode(process.env.AUTH_COOKIE_SAME_SITE),
    });
    const authController = new AuthController(
      this.container.authService,
      this.container.passwordResetService,
      sessionCookieFactory,
    );
    const moduleController = new ModuleController(this.container.moduleManagementService, this.permissionGuard);
    const clientController = new ClientController(this.container.clientService, this.moduleGuard, this.permissionGuard);
    const projectAgentController = new ProjectAgentController(this.container.projectAgentService, this.moduleGuard, this.permissionGuard);
    const userPreferenceController = new UserPreferenceController(this.container.userPreferenceService);
    const projectController = new ProjectController(this.container.projectService, this.moduleGuard, this.permissionGuard);
    const knowledgeController = new KnowledgeController(
      this.container.documentIntelligenceService,
      this.moduleGuard,
      this.permissionGuard,
    );
    const assistantController = new AssistantController(
      this.container.assistantSessionService,
      this.container.assistantConversationService,
      this.moduleGuard,
      this.permissionGuard,
    );
    const legacyProjectAssetsController = new LegacyProjectAssetsController(
      this.container.documentArchiveService,
      this.container.projectService,
      this.container.legacyQuotationOrchestratorService,
      this.moduleGuard,
      this.permissionGuard,
    );
    const legacyOrchestratorController = new LegacyOrchestratorController(this.container.legacyQuotationOrchestratorService);
    const legacyDdtReaderController = new LegacyDdtReaderController(
      this.container.legacyDdtReaderService,
      this.moduleGuard,
      this.permissionGuard,
    );
    const shipmentController = new ShipmentController(this.container.shipmentService, this.moduleGuard, this.permissionGuard);
    const ddtController = new DdtController(this.container.ddtProcessingService, this.moduleGuard, this.permissionGuard);
    const notificationController = new NotificationController(this.container.notificationService, this.moduleGuard, this.permissionGuard);

    this.app.get("/health", async () => {
      const payload = {
        ok: true as const,
        timestamp: new Date().toISOString(),
      };

      return healthSchema.parse(payload);
    });

    this.app.post("/api/auth/login", authController.login);
    this.app.post("/api/auth/logout", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, authController.logout);
    this.app.get("/api/auth/session", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, authController.session);
    this.app.post("/api/auth/password/forgot", authController.forgotPassword);
    this.app.post("/api/auth/password/reset", authController.resetPassword);

    this.app.get("/api/modules", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleController.listWorkspaceModules);
    this.app.post("/api/modules/:moduleKey/enable", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleController.enableModule);
    this.app.post("/api/modules/:moduleKey/disable", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleController.disableModule);
    this.app.get("/api/modules/users/:userId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleController.listUserModules);
    this.app.post("/api/modules/users/:userId/:moduleKey/allow", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleController.allowModuleForUser);
    this.app.post("/api/modules/users/:userId/:moduleKey/deny", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleController.denyModuleForUser);
    this.app.delete("/api/modules/users/:userId/:moduleKey/override", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleController.clearUserOverride);

    this.app.get("/api/clients", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, clientController.list);
    this.app.post("/api/clients", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, clientController.create);
    this.app.get("/api/clients/:clientId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, clientController.getById);
    this.app.patch("/api/clients/:clientId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, clientController.update);
    this.app.delete("/api/clients/:clientId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, clientController.delete);

    this.app.get("/api/user/preferences", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, userPreferenceController.get);
    this.app.patch("/api/user/preferences", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, userPreferenceController.patch);

    this.app.get("/api/projects", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.listProjects);
    this.app.post("/api/projects", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.createProject);
    this.app.get("/api/projects/:projectId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.getProject);
    this.app.patch("/api/projects/:projectId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.updateProject);
    this.app.delete("/api/projects/:projectId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.deleteProject);
    this.app.get("/api/projects/:projectId/versions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.listVersions);
    this.app.post("/api/projects/:projectId/versions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.createVersion);
    this.app.patch("/api/projects/:projectId/versions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.setDefaultVersionCompatibility);
    this.app.delete("/api/projects/:projectId/versions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.deleteVersionCompatibility);
    this.app.patch("/api/projects/:projectId/versions/default", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.setDefaultVersion);
    this.app.delete("/api/projects/:projectId/versions/:versionLabel", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectController.deleteVersion);

    this.app.get("/api/projects/:projectId/files", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.listProjectFiles);
    this.app.get("/api/projects/:projectId/files/:fileKind", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.getProjectFileMetadata);
    this.app.post("/api/projects/:projectId/files/:fileKind", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.putProjectFile);
    this.app.delete("/api/projects/:projectId/files/:fileKind", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.deleteProjectFile);
    this.app.get("/api/projects/:projectId/files/:fileKind/content", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.getProjectFileContent);
    this.app.get("/api/projects/:projectId/quotation", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.getQuotation);
    this.app.post("/api/projects/:projectId/quotation", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.postQuotation);
    this.app.delete("/api/projects/:projectId/quotation", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.deleteQuotation);
    this.app.get("/api/projects/:projectId/quotation/file", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.getQuotationFile);
    this.app.post("/api/projects/:projectId/quotation/analyze", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyProjectAssetsController.analyzeQuotation);

    this.app.get("/api/agents", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAgentController.listAgents);
    this.app.patch("/api/agents/:agentId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAgentController.updateAgentPrompt);
    this.app.post("/api/agents/:agentId/reset-prompt", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAgentController.resetAgentPrompt);

    this.app.get("/api/shipments", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.listShipments);
    this.app.post("/api/shipments", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.createShipment);
    this.app.get("/api/shipments/:shipmentId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.getShipment);
    this.app.patch("/api/shipments/:shipmentId/specification", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.updateShipmentSpecification);

    this.app.post("/api/knowledge/documents/:documentId/refresh", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, knowledgeController.refreshDocument);
    this.app.get("/api/knowledge/search", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, knowledgeController.search);
    this.app.get("/api/knowledge/projects/:projectId/versions/:versionLabel/quotation-context", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, knowledgeController.getQuotationContext);

    this.app.get("/api/assistant/sessions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.listSessions);
    this.app.post("/api/assistant/sessions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.createSession);
    this.app.get("/api/assistant/sessions/:sessionId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.getSession);
    this.app.get("/api/assistant/sessions/:sessionId/messages", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.listMessages);
    this.app.post("/api/assistant/sessions/:sessionId/messages", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.postMessage);
    this.app.post("/api/assistant/sessions/:sessionId/close", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.closeSession);

    this.app.get("/api/orchestrator/jobs/:jobId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyOrchestratorController.getJob);

    this.app.get("/api/ddt-reader/config", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyDdtReaderController.getConfig);
    this.app.get("/api/ddt-reader/documents", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyDdtReaderController.listDocuments);
    this.app.post("/api/ddt-reader/documents", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyDdtReaderController.uploadDocument);
    this.app.get("/api/ddt-reader/documents/:id", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyDdtReaderController.getDocument);
    this.app.post("/api/ddt-reader/documents/:id/analyze", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyDdtReaderController.analyzeDocument);
    this.app.delete("/api/ddt-reader/documents/:id", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyDdtReaderController.deleteDocument);
    this.app.get("/api/ddt-reader/documents/:id/file", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, legacyDdtReaderController.getDocumentFile);

    this.app.post("/api/ddt/documents/:documentId/analyze", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, ddtController.analyzeDocument);

    this.app.get("/api/notifications", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.listForUser);
    this.app.patch("/api/notifications", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.markAllAsRead);
    this.app.delete("/api/notifications", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.clearForUser);
    this.app.patch("/api/notifications/read-all", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.markAllAsRead);
    this.app.post("/api/notifications", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.createInfo);
  }

  private registerErrorHandler(): void {
    this.app.setErrorHandler((error, _request, reply) => {
      if (error instanceof AppError) {
        reply.code(error.statusCode).send({ code: error.code, message: error.message });
        return;
      }

      if (error instanceof z.ZodError) {
        reply.code(400).send({ code: "VALIDATION_ERROR", message: "Invalid payload.", issues: error.issues });
        return;
      }

      this.app.log.error(error);
      reply.code(500).send({ code: "INTERNAL_ERROR", message: "Unexpected error." });
    });
  }

  private resolveTrustProxy(): boolean {
    return this.resolveBooleanEnv("TRUST_PROXY", false);
  }

  private resolveBooleanEnv(name: string, defaultValue: boolean): boolean {
    const value = process.env[name];
    if (!value) {
      return defaultValue;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
  }

  private resolveSameSiteMode(value: string | undefined): "Strict" | "Lax" | "None" {
    const normalized = value?.trim().toLowerCase();
    if (normalized === "strict") {
      return "Strict";
    }

    if (normalized === "none") {
      return "None";
    }

    return "Lax";
  }
}
