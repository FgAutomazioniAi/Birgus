import Fastify from "fastify";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { z } from "zod";

import { ApplicationContainer } from "../composition/ApplicationContainer.js";
import { AppError } from "../core/errors/AppError.js";
import { ModuleGuard } from "./middleware/ModuleGuard.js";
import { AuthMiddleware } from "./middleware/AuthMiddleware.js";
import { PermissionGuard } from "./middleware/PermissionGuard.js";
import { AuthController } from "./controllers/AuthController.js";
import { AssistantController } from "./controllers/AssistantController.js";
import { AuditController } from "./controllers/AuditController.js";
import { SessionCookieFactory } from "./auth/SessionCookieFactory.js";
import { ClientController } from "./controllers/ClientController.js";
import { CompanyController } from "./controllers/CompanyController.js";
import { DdtController } from "./controllers/DdtController.js";
import { KnowledgeController } from "./controllers/KnowledgeController.js";
import { DdtReaderController } from "./controllers/DdtReaderController.js";
import { OrchestratorJobController } from "./controllers/OrchestratorJobController.js";
import { ProjectAssetsController } from "./controllers/ProjectAssetsController.js";
import { ModuleController } from "./controllers/ModuleController.js";
import { NotificationController } from "./controllers/NotificationController.js";
import { ModuleAgentController } from "./controllers/ModuleAgentController.js";
import { ProjectController } from "./controllers/ProjectController.js";
import { ProjectAuthorController } from "./controllers/ProjectAuthorController.js";
import { ProjectRevisionController } from "./controllers/ProjectRevisionController.js";
import { ShipmentController } from "./controllers/ShipmentController.js";
import { UserPreferenceController } from "./controllers/UserPreferenceController.js";
import { WorkflowController } from "./controllers/WorkflowController.js";

const healthSchema = z.object({
  ok: z.literal(true),
  timestamp: z.string(),
});

interface SwaggerRouteDoc {
  description: string;
  summary: string;
  tags: string[];
}

const SWAGGER_ROUTE_DOCS: Record<string, SwaggerRouteDoc> = {
  "GET /health": {
    summary: "Verifica stato servizio",
    description: `Controlla che l'API sia raggiungibile e restituisce un timestamp server.`,
    tags: ["Sistema"],
  },
  "POST /api/auth/login": {
    summary: "Login utente",
    description: `Autentica un utente con email e password e crea la sessione applicativa.`,
    tags: ["Auth"],
  },
  "POST /api/auth/logout": {
    summary: "Logout utente",
    description: `Invalida la sessione corrente dell'utente autenticato.`,
    tags: ["Auth"],
  },
  "GET /api/auth/session": {
    summary: "Sessione corrente",
    description: `Restituisce i dati della sessione autenticata corrente.`,
    tags: ["Auth"],
  },
  "POST /api/auth/password/forgot": {
    summary: "Avvio reset password",
    description: `Genera e invia il codice per il reset password dell'utente.`,
    tags: ["Auth"],
  },
  "POST /api/auth/password/reset": {
    summary: "Reset password",
    description: `Conferma il codice ricevuto e imposta la nuova password.`,
    tags: ["Auth"],
  },
};

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
    this.app.after(() => {
      this.registerRoutes();
      this.registerDocumentationUi();
    });
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

    this.app.addHook("onRoute", (routeOptions) => {
      if (routeOptions.url.startsWith("/documentation")) {
        return;
      }

      const method = this.resolveSwaggerMethod(routeOptions.method);
      const routeDoc = this.resolveSwaggerRouteDoc(method, routeOptions.url);
      const existingSchema =
        routeOptions.schema && typeof routeOptions.schema === "object"
          ? (routeOptions.schema as Record<string, unknown>)
          : {};
      const existingDescription = typeof existingSchema.description === "string"
        ? existingSchema.description
        : undefined;
      const existingSummary = typeof existingSchema.summary === "string"
        ? existingSchema.summary
        : undefined;
      const existingTags = Array.isArray(existingSchema.tags) && existingSchema.tags.every((item) => typeof item === "string")
        ? (existingSchema.tags as string[])
        : undefined;

      routeOptions.schema = {
        ...existingSchema,
        description: existingDescription ?? routeDoc.description,
        summary: existingSummary ?? routeDoc.summary,
        tags: existingTags && existingTags.length > 0
          ? existingTags
          : routeDoc.tags,
      };
    });

    this.app.register(swagger, {
      mode: "dynamic",
      openapi: {
        info: {
          title: "Birgus API",
          version: "1.0.0",
        },
      },
    });

  }

  private registerDocumentationUi(): void {
    this.app.register(swaggerUI, {
      routePrefix: "/documentation",
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
    const auditController = new AuditController(this.container.auditLogService, this.moduleGuard, this.permissionGuard);
    const companyController = new CompanyController(this.container.companyService, this.moduleGuard, this.permissionGuard);
    const clientController = new ClientController(this.container.clientService, this.moduleGuard, this.permissionGuard);
    const moduleAgentController = new ModuleAgentController(this.container.moduleAgentService, this.moduleGuard, this.permissionGuard);
    const userPreferenceController = new UserPreferenceController(this.container.userPreferenceService);
    const projectAuthorController = new ProjectAuthorController(this.container.projectAuthorService, this.moduleGuard, this.permissionGuard);
    const projectController = new ProjectController(this.container.projectService, this.moduleGuard, this.permissionGuard);
    const projectRevisionController = new ProjectRevisionController(this.container.projectRevisionService, this.moduleGuard, this.permissionGuard);
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
    const projectAssetsController = new ProjectAssetsController(
      this.container.documentArchiveService,
      this.container.projectService,
      this.container.quotationOrchestratorService,
      this.moduleGuard,
      this.permissionGuard,
    );
    const orchestratorJobController = new OrchestratorJobController(this.container.quotationOrchestratorService);
    const ddtReaderController = new DdtReaderController(
      this.container.ddtReaderService,
      this.moduleGuard,
      this.permissionGuard,
    );
    const shipmentController = new ShipmentController(this.container.shipmentService, this.moduleGuard, this.permissionGuard);
    const ddtController = new DdtController(this.container.ddtProcessingService, this.moduleGuard, this.permissionGuard);
    const notificationController = new NotificationController(this.container.notificationService, this.moduleGuard, this.permissionGuard);
    const workflowController = new WorkflowController(this.container.workflowService, this.moduleGuard, this.permissionGuard);

    this.app.get("/health", {
      schema: {
        tags: ["system"],
        summary: "Health check",
        response: {
          200: {
            type: "object",
            required: ["ok", "timestamp"],
            properties: {
              ok: { type: "boolean" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    }, async () => {
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

    this.app.get("/api/companies", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, companyController.list);
    this.app.post("/api/companies", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, companyController.create);
    this.app.get("/api/companies/:companyId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, companyController.getById);
    this.app.patch("/api/companies/:companyId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, companyController.update);
    this.app.delete("/api/companies/:companyId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, companyController.delete);

    this.app.get("/api/user/preferences", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, userPreferenceController.get);
    this.app.patch("/api/user/preferences", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, userPreferenceController.patch);

    this.app.get("/api/project-authors", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAuthorController.list);
    this.app.post("/api/project-authors", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAuthorController.create);
    this.app.get("/api/project-authors/:authorId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAuthorController.getById);
    this.app.patch("/api/project-authors/:authorId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAuthorController.update);
    this.app.delete("/api/project-authors/:authorId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAuthorController.delete);

    this.app.get("/api/project-revisions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectRevisionController.list);
    this.app.post("/api/project-revisions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectRevisionController.create);
    this.app.get("/api/project-revisions/:revisionId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectRevisionController.getById);
    this.app.patch("/api/project-revisions/:revisionId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectRevisionController.update);
    this.app.delete("/api/project-revisions/:revisionId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectRevisionController.delete);

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

    this.app.get("/api/projects/:projectId/files", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.listProjectFiles);
    this.app.get("/api/projects/:projectId/files/:fileKind", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.getProjectFileMetadata);
    this.app.post("/api/projects/:projectId/files/:fileKind", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.putProjectFile);
    this.app.delete("/api/projects/:projectId/files/:fileKind", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.deleteProjectFile);
    this.app.get("/api/projects/:projectId/files/:fileKind/content", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.getProjectFileContent);
    this.app.get("/api/projects/:projectId/quotation", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.getQuotation);
    this.app.post("/api/projects/:projectId/quotation", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.postQuotation);
    this.app.delete("/api/projects/:projectId/quotation", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.deleteQuotation);
    this.app.get("/api/projects/:projectId/quotation/file", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.getQuotationFile);
    this.app.post("/api/projects/:projectId/quotation/analyze", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, projectAssetsController.analyzeQuotation);

    this.app.get("/api/agents", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleAgentController.listAgents);
    this.app.patch("/api/agents/:agentId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleAgentController.updateAgentPrompt);
    this.app.post("/api/agents/:agentId/reset-prompt", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, moduleAgentController.resetAgentPrompt);

    this.app.get("/api/shipments", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.listShipments);
    this.app.post("/api/shipments", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.createShipment);
    this.app.get("/api/shipments/:shipmentId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.getShipment);
    this.app.patch("/api/shipments/:shipmentId/specification", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.updateShipmentSpecification);
    this.app.put("/api/shipments/:shipmentId/items", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.replaceShipmentItems);
    this.app.post("/api/shipments/:shipmentId/events", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, shipmentController.addShipmentEvent);

    this.app.get("/api/workflows/tools", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, workflowController.listTools);
    this.app.get("/api/workflows", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, workflowController.listWorkflows);
    this.app.post("/api/workflows", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, workflowController.createWorkflow);
    this.app.get("/api/workflows/:workflowId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, workflowController.getWorkflow);
    this.app.patch("/api/workflows/:workflowId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, workflowController.updateWorkflow);
    this.app.get("/api/workflows/:workflowId/runs", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, workflowController.listWorkflowRuns);
    this.app.post("/api/workflows/:workflowId/runs", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, workflowController.createWorkflowRun);
    this.app.get("/api/workflow-runs/:runId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, workflowController.getWorkflowRun);

    this.app.post("/api/knowledge/documents/:documentId/refresh", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, knowledgeController.refreshDocument);
    this.app.get("/api/knowledge/search", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, knowledgeController.search);
    this.app.get("/api/knowledge/projects/:projectId/versions/:versionLabel/quotation-context", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, knowledgeController.getQuotationContext);

    this.app.get("/api/assistant/sessions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.listSessions);
    this.app.post("/api/assistant/sessions", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.createSession);
    this.app.get("/api/assistant/sessions/:sessionId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.getSession);
    this.app.get("/api/assistant/sessions/:sessionId/messages", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.listMessages);
    this.app.post("/api/assistant/sessions/:sessionId/messages", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.postMessage);
    this.app.post("/api/assistant/sessions/:sessionId/close", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, assistantController.closeSession);

    this.app.get("/api/orchestrator/jobs/:jobId", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, orchestratorJobController.getJob);

    this.app.get("/api/ddt-reader/config", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, ddtReaderController.getConfig);
    this.app.get("/api/ddt-reader/documents", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, ddtReaderController.listDocuments);
    this.app.post("/api/ddt-reader/documents", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, ddtReaderController.uploadDocument);
    this.app.get("/api/ddt-reader/documents/:id", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, ddtReaderController.getDocument);
    this.app.post("/api/ddt-reader/documents/:id/analyze", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, ddtReaderController.analyzeDocument);
    this.app.delete("/api/ddt-reader/documents/:id", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, ddtReaderController.deleteDocument);
    this.app.get("/api/ddt-reader/documents/:id/file", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, ddtReaderController.getDocumentFile);

    this.app.post("/api/ddt/documents/:documentId/analyze", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, ddtController.analyzeDocument);

    this.app.get("/api/notifications", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.listForUser);
    this.app.patch("/api/notifications", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.markAllAsRead);
    this.app.delete("/api/notifications", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.clearForUser);
    this.app.patch("/api/notifications/read-all", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.markAllAsRead);
    this.app.post("/api/notifications", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, notificationController.createInfo);

    this.app.get("/api/audit/logs", { preHandler: this.authMiddleware.requireAuthenticated.bind(this.authMiddleware) }, auditController.list);
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

  private resolveSwaggerMethod(method: unknown): string {
    if (Array.isArray(method)) {
      const first = method.find((item) => typeof item === "string");
      return typeof first === "string" ? first.toUpperCase() : "GET";
    }

    return typeof method === "string" && method.trim().length > 0 ? method.trim().toUpperCase() : "GET";
  }

  private resolveSwaggerRouteDoc(method: string, url: string): SwaggerRouteDoc {
    const explicitDoc = SWAGGER_ROUTE_DOCS[`${method} ${url}`];
    if (explicitDoc) {
      return explicitDoc;
    }

    const domain = this.resolveRouteDomain(url);
    const action = this.resolveRouteAction(method);
    const resource = this.resolveRouteResourceLabel(url);
    const requiresAuth = !(
      url === "/health" ||
      url === "/api/auth/login" ||
      url === "/api/auth/password/forgot" ||
      url === "/api/auth/password/reset"
    );

    return {
      summary: `${action} ${resource}`,
      description: requiresAuth
        ? `Endpoint ${method} ${url}. Richiede sessione autenticata.`
        : `Endpoint ${method} ${url}. Accessibile senza sessione autenticata.`,
      tags: [domain],
    };
  }

  private resolveRouteDomain(url: string): string {
    const domains: Array<{ prefix: string; tag: string }> = [
      { prefix: "/api/auth", tag: "Auth" },
      { prefix: "/api/modules", tag: "Moduli" },
      { prefix: "/api/clients", tag: "Clienti" },
      { prefix: "/api/companies", tag: "Aziende" },
      { prefix: "/api/user/preferences", tag: "Preferenze" },
      { prefix: "/api/project-authors", tag: "Autori Progetto" },
      { prefix: "/api/project-revisions", tag: "Revisioni Progetto" },
      { prefix: "/api/projects", tag: "Progetti" },
      { prefix: "/api/agents", tag: "Agenti" },
      { prefix: "/api/shipments", tag: "Spedizioni" },
      { prefix: "/api/workflows", tag: "Workflow" },
      { prefix: "/api/workflow-runs", tag: "Workflow" },
      { prefix: "/api/knowledge", tag: "Knowledge" },
      { prefix: "/api/assistant", tag: "Assistant" },
      { prefix: "/api/orchestrator", tag: "Orchestrator" },
      { prefix: "/api/ddt-reader", tag: "DDT Reader" },
      { prefix: "/api/ddt", tag: "DDT" },
      { prefix: "/api/notifications", tag: "Notifiche" },
      { prefix: "/api/audit", tag: "Audit" },
      { prefix: "/health", tag: "Sistema" },
    ];

    const match = domains.find((entry) => url.startsWith(entry.prefix));
    return match?.tag ?? "API";
  }

  private resolveRouteAction(method: string): string {
    switch (method) {
      case "GET":
        return "Recupera";
      case "POST":
        return "Crea o avvia";
      case "PATCH":
        return "Aggiorna";
      case "PUT":
        return "Sostituisce";
      case "DELETE":
        return "Elimina";
      default:
        return "Gestisce";
    }
  }

  private resolveRouteResourceLabel(url: string): string {
    const segments = url.split("/").filter(Boolean).filter((segment) => !segment.startsWith(":"));
    const last = segments[segments.length - 1] ?? "risorsa";
    const normalized = last.replace(/-/g, " ").toLowerCase();
    const labels: Record<string, string> = {
      agents: "agenti",
      analyze: "analisi",
      "audit logs": "log audit",
      clients: "clienti",
      close: "sessione",
      companies: "aziende",
      config: "configurazione",
      content: "contenuto file",
      documents: "documenti",
      events: "eventi",
      files: "file",
      items: "articoli spedizione",
      knowledge: "knowledge base",
      login: "autenticazione",
      logout: "sessione",
      messages: "messaggi",
      modules: "moduli",
      notifications: "notifiche",
      "read all": "lettura notifiche",
      preferences: "preferenze utente",
      projects: "progetti",
      quotation: "preventivo",
      "quotation context": "contesto preventivo",
      revisions: "revisioni",
      runs: "esecuzioni workflow",
      search: "ricerca",
      session: "sessione",
      sessions: "sessioni",
      shipments: "spedizioni",
      specification: "specifiche spedizione",
      tools: "tools workflow",
      users: "moduli utente",
      versions: "versioni progetto",
      workflows: "workflow",
    };

    return labels[normalized] ?? normalized;
  }
}
