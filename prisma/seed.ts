import { randomBytes, scrypt } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { DEFAULT_MODULE_AGENT_PROMPTS } from "../src/modules/agents/domain/DefaultModuleAgentPrompts.js";

const prisma = new PrismaClient();

const MODULE_KEYS = [
  "project_management",
  "agent_management",
  "shipment_management",
  "ddt_processing",
  "document_archive",
  "document_intelligence",
  "conversational_assistant",
  "workflow_management",
  "notification_center",
  "audit_center",
] as const;

const ROLE_KEYS = ["superadmin", "admin", "operator"] as const;

const PERMISSION_KEYS = [
  "modules.read",
  "modules.configure",
  "projects.read",
  "projects.write",
  "agents.read",
  "agents.write",
  "clients.read",
  "clients.write",
  "documents.read",
  "documents.write",
  "shipments.read",
  "shipments.write",
  "ddt.read",
  "ddt.process",
  "knowledge.read",
  "knowledge.write",
  "assistant.read",
  "assistant.write",
  "assistant.configure",
  "workflows.read",
  "workflows.write",
  "workflows.configure",
  "notifications.read",
  "notifications.write",
  "audit.read",
] as const;

const ROLE_PERMISSION_MATRIX: Record<(typeof ROLE_KEYS)[number], readonly (typeof PERMISSION_KEYS)[number][]> = {
  superadmin: PERMISSION_KEYS,
  admin: [
    "modules.read",
    "modules.configure",
    "projects.read",
    "projects.write",
    "agents.read",
    "agents.write",
    "clients.read",
    "clients.write",
    "documents.read",
    "documents.write",
    "shipments.read",
    "shipments.write",
    "ddt.read",
    "ddt.process",
    "knowledge.read",
    "knowledge.write",
    "assistant.read",
    "assistant.write",
    "assistant.configure",
    "workflows.read",
    "workflows.write",
    "workflows.configure",
    "notifications.read",
    "notifications.write",
  ],
  operator: [
    "modules.read",
    "projects.read",
    "projects.write",
    "agents.read",
    "agents.write",
    "clients.read",
    "clients.write",
    "documents.read",
    "documents.write",
    "shipments.read",
    "shipments.write",
    "ddt.read",
    "ddt.process",
    "knowledge.read",
    "assistant.read",
    "assistant.write",
    "workflows.read",
    "notifications.read",
  ],
} as const;

const PROJECT_STATUSES = [
  { key: "in_revisione", label: "In Revisione" },
  { key: "completato", label: "Completato" },
  { key: "in_attesa", label: "In Attesa" },
] as const;

const SHIPMENT_STATUSES = [
  { key: "draft", label: "Bozza" },
  { key: "prepared", label: "Preparata" },
  { key: "shipped", label: "Spedita" },
  { key: "delivered", label: "Consegnata" },
] as const;

const FILE_TYPES = [
  { key: "pdf", mimeType: "application/pdf" },
  { key: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { key: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
] as const;

const FILE_STATUSES = ["uploaded", "reviewed", "approved"] as const;

const normalizePassword = (password: string) => password.normalize("NFKC");

const deriveScryptHash = async (password: string, salt: string, keyLength: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, { N: 16384, p: 1, r: 8 }, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Buffer.from(derivedKey));
    });
  });

async function hashPassword(password: string): Promise<string> {
  const pepper = process.env.AUTH_PEPPER ?? "";
  const salt = randomBytes(16).toString("base64url");
  const derived = await deriveScryptHash(normalizePassword(password) + pepper, salt, 64);
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

async function main() {
  const organizationCode = "birgus";
  const workspaceCode = "main";

  const legacyAgentModule = await prisma.module.findUnique({
    where: { key: "project_agents" },
    select: { id: true },
  });

  if (legacyAgentModule) {
    await prisma.module.update({
      where: { id: legacyAgentModule.id },
      data: {
        key: "agent_management",
        name: "agent_management",
      },
    });
  }

  let organization = await prisma.organization.findUnique({
    where: { code: organizationCode },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        code: organizationCode,
        legal_name: "Birgus Platform",
      },
    });
  }

  let workspace = await prisma.workspace.findFirst({
    where: {
      organization_id: organization.id,
      code: workspaceCode,
    },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        organization_id: organization.id,
        code: workspaceCode,
        name: "Main Workspace",
      },
    });
  }

  for (const roleKey of ROLE_KEYS) {
    await prisma.role.upsert({
      where: { key: roleKey },
      update: { label: roleKey, is_system: true },
      create: { key: roleKey, label: roleKey, is_system: true },
    });
  }

  for (const permissionKey of PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key: permissionKey },
      update: { label: permissionKey },
      create: { key: permissionKey, label: permissionKey },
    });
  }

  const roles = await prisma.role.findMany({
    where: {
      key: {
        in: [...ROLE_KEYS],
      },
    },
  });

  const permissions = await prisma.permission.findMany({
    where: {
      key: {
        in: [...PERMISSION_KEYS],
      },
    },
  });

  const roleByKey = new Map(roles.map((item) => [item.key, item]));
  const permissionByKey = new Map(permissions.map((item) => [item.key, item]));

  for (const roleKey of ROLE_KEYS) {
    const role = roleByKey.get(roleKey);
    if (!role) {
      continue;
    }

    for (const permissionKey of ROLE_PERMISSION_MATRIX[roleKey]) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: role.id,
            permission_id: permission.id,
          },
        },
        update: {},
        create: {
          role_id: role.id,
          permission_id: permission.id,
        },
      });
    }
  }

  const superadminRole = roleByKey.get("superadmin");
  const adminRole = roleByKey.get("admin");
  const operatorRole = roleByKey.get("operator");
  if (!superadminRole || !adminRole || !operatorRole) {
    throw new Error("Required roles not found after seed role creation.");
  }

  for (const moduleKey of MODULE_KEYS) {
    await prisma.module.upsert({
      where: { key: moduleKey },
      update: { name: moduleKey, is_active: true },
      create: {
        key: moduleKey,
        name: moduleKey,
        is_active: true,
      },
    });
  }

  const deprecatedApiViewerModule = await prisma.module.findUnique({
    where: { key: "api_viewer" },
    select: { id: true },
  });

  if (deprecatedApiViewerModule) {
    await prisma.userModuleOverride.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.workspaceModule.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.moduleDependency.deleteMany({
      where: {
        OR: [
          { module_id: deprecatedApiViewerModule.id },
          { depends_on_module_id: deprecatedApiViewerModule.id },
        ],
      },
    });
    await prisma.moduleAgent.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.moduleTool.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.moduleWorkflow.deleteMany({
      where: { module_id: deprecatedApiViewerModule.id },
    });
    await prisma.module.delete({
      where: { id: deprecatedApiViewerModule.id },
    });
  }

  const modules = await prisma.module.findMany();
  for (const module of modules) {
    await prisma.workspaceModule.upsert({
      where: {
        workspace_id_module_id: {
          workspace_id: workspace.id,
          module_id: module.id,
        },
      },
      update: {
        is_enabled: true,
      },
      create: {
        workspace_id: workspace.id,
        module_id: module.id,
        is_enabled: true,
      },
    });
  }

  const moduleByKey = new Map(modules.map((item) => [item.key, item]));
  const projectManagementModule = moduleByKey.get("project_management");
  const agentManagementModule = moduleByKey.get("agent_management");
  const documentArchiveModule = moduleByKey.get("document_archive");
  const documentIntelligenceModule = moduleByKey.get("document_intelligence");
  const conversationalAssistantModule = moduleByKey.get("conversational_assistant");
  const workflowManagementModule = moduleByKey.get("workflow_management");
  const notificationCenterModule = moduleByKey.get("notification_center");
  const auditCenterModule = moduleByKey.get("audit_center");

  if (projectManagementModule && agentManagementModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: agentManagementModule.id,
          depends_on_module_id: projectManagementModule.id,
        },
      },
      update: {},
      create: {
        module_id: agentManagementModule.id,
        depends_on_module_id: projectManagementModule.id,
      },
    });
  }

  if (documentArchiveModule && documentIntelligenceModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: documentIntelligenceModule.id,
          depends_on_module_id: documentArchiveModule.id,
        },
      },
      update: {},
      create: {
        module_id: documentIntelligenceModule.id,
        depends_on_module_id: documentArchiveModule.id,
      },
    });
  }

  if (documentIntelligenceModule && conversationalAssistantModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: conversationalAssistantModule.id,
          depends_on_module_id: documentIntelligenceModule.id,
        },
      },
      update: {},
      create: {
        module_id: conversationalAssistantModule.id,
        depends_on_module_id: documentIntelligenceModule.id,
      },
    });
  }

  if (workflowManagementModule && agentManagementModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: workflowManagementModule.id,
          depends_on_module_id: agentManagementModule.id,
        },
      },
      update: {},
      create: {
        module_id: workflowManagementModule.id,
        depends_on_module_id: agentManagementModule.id,
      },
    });
  }

  if (workflowManagementModule && documentIntelligenceModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: workflowManagementModule.id,
          depends_on_module_id: documentIntelligenceModule.id,
        },
      },
      update: {},
      create: {
        module_id: workflowManagementModule.id,
        depends_on_module_id: documentIntelligenceModule.id,
      },
    });
  }

  if (auditCenterModule && notificationCenterModule) {
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: auditCenterModule.id,
          depends_on_module_id: notificationCenterModule.id,
        },
      },
      update: {},
      create: {
        module_id: auditCenterModule.id,
        depends_on_module_id: notificationCenterModule.id,
      },
    });
  }

  for (const status of PROJECT_STATUSES) {
    await prisma.projectStatus.upsert({
      where: {
        workspace_id_key: {
          workspace_id: workspace.id,
          key: status.key,
        },
      },
      update: {
        label: status.label,
      },
      create: {
        workspace_id: workspace.id,
        key: status.key,
        label: status.label,
      },
    });
  }

  for (const status of SHIPMENT_STATUSES) {
    await prisma.shipmentStatus.upsert({
      where: {
        workspace_id_key: {
          workspace_id: workspace.id,
          key: status.key,
        },
      },
      update: {
        label: status.label,
      },
      create: {
        workspace_id: workspace.id,
        key: status.key,
        label: status.label,
      },
    });
  }

  for (const revisionCode of ["v1", "v2"]) {
    await prisma.projectRevision.upsert({
      where: {
        workspace_id_code: {
          workspace_id: workspace.id,
          code: revisionCode,
        },
      },
      update: {},
      create: {
        workspace_id: workspace.id,
        code: revisionCode,
      },
    });
  }

  for (const fileType of FILE_TYPES) {
    await prisma.fileType.upsert({
      where: {
        key: fileType.key,
      },
      update: {
        mime_type: fileType.mimeType,
      },
      create: {
        key: fileType.key,
        mime_type: fileType.mimeType,
      },
    });
  }

  for (const fileStatus of FILE_STATUSES) {
    await prisma.fileStatus.upsert({
      where: {
        key: fileStatus,
      },
      update: {},
      create: {
        key: fileStatus,
      },
    });
  }

  const accountDefinitions = [
    {
      email: "samuel.m@fgautomazioni.it",
      firstName: "Samuel",
      lastName: "M",
      roleKey: "superadmin",
      roleId: superadminRole.id,
    },
    {
      email: "admin@birgus.it",
      firstName: "Birgus",
      lastName: "Admin",
      roleKey: "admin",
      roleId: adminRole.id,
    },
    {
      email: "guest@birgus.it",
      firstName: "Birgus",
      lastName: "Guest",
      roleKey: "operator",
      roleId: operatorRole.id,
    },
  ] as const;

  const desiredEmails = accountDefinitions.map((item) => item.email);
  const staleUsers = await prisma.user.findMany({
    where: {
      email: {
        notIn: desiredEmails,
      },
    },
    select: {
      id: true,
    },
  });

  const staleUserIds = staleUsers.map((item) => item.id);
  if (staleUserIds.length > 0) {
    await prisma.userModuleOverride.deleteMany({
      where: {
        user_id: {
          in: staleUserIds,
        },
      },
    });
    await prisma.userWorkspaceRole.deleteMany({
      where: {
        user_id: {
          in: staleUserIds,
        },
      },
    });
    await prisma.workspaceMembership.deleteMany({
      where: {
        user_id: {
          in: staleUserIds,
        },
      },
    });
    await prisma.userPreference.deleteMany({
      where: {
        user_id: {
          in: staleUserIds,
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: staleUserIds,
        },
      },
    });
  }

  const seededUsers = new Map<string, { id: string; email: string; roleKey: string }>();
  for (const account of accountDefinitions) {
    const passwordHash = await hashPassword("admin");
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        first_name: account.firstName,
        last_name: account.lastName,
        password_hash: passwordHash,
        is_active: true,
      },
      create: {
        email: account.email,
        first_name: account.firstName,
        last_name: account.lastName,
        password_hash: passwordHash,
        is_active: true,
      },
    });

    await prisma.workspaceMembership.upsert({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: user.id,
        },
      },
      update: {
        status: "ACTIVE",
      },
      create: {
        workspace_id: workspace.id,
        user_id: user.id,
        status: "ACTIVE",
      },
    });

    await prisma.userWorkspaceRole.deleteMany({
      where: {
        workspace_id: workspace.id,
        user_id: user.id,
      },
    });

    await prisma.userWorkspaceRole.create({
      data: {
        workspace_id: workspace.id,
        user_id: user.id,
        role_id: account.roleId,
      },
    });

    await prisma.userPreference.upsert({
      where: {
        user_id_workspace_id: {
          user_id: user.id,
          workspace_id: workspace.id,
        },
      },
      update: {
        palette_id: "predefinito",
        language_code: "it",
      },
      create: {
        user_id: user.id,
        workspace_id: workspace.id,
        palette_id: "predefinito",
        language_code: "it",
        rows_projects: 20,
        rows_clients: 20,
      },
    });

    seededUsers.set(account.email, { id: user.id, email: user.email, roleKey: account.roleKey });
  }

  const samuelUser = seededUsers.get("samuel.m@fgautomazioni.it");
  const adminUser = seededUsers.get("admin@birgus.it");
  const guestUser = seededUsers.get("guest@birgus.it");
  if (!samuelUser || !adminUser || !guestUser) {
    throw new Error("Seeded users are incomplete.");
  }

  const desiredOverridesByUserId = new Map<string, Array<{ moduleId: number; mode: "ALLOW" | "DENY"; reason: string }>>();

  const pushOverride = (userId: string, moduleId: number | undefined, mode: "ALLOW" | "DENY", reason: string) => {
    if (!moduleId) {
      return;
    }

    const current = desiredOverridesByUserId.get(userId) ?? [];
    current.push({ moduleId, mode, reason });
    desiredOverridesByUserId.set(userId, current);
  };

  const documentIntelligenceModuleId = documentIntelligenceModule?.id;
  const agentManagementModuleId = agentManagementModule?.id;
  const workflowManagementModuleId = workflowManagementModule?.id;
  const auditCenterModuleId = auditCenterModule?.id;
  pushOverride(
    adminUser.id,
    auditCenterModuleId,
    "DENY",
    "Il centro audit resta riservato al superadmin.",
  );

  pushOverride(
    guestUser.id,
    documentIntelligenceModuleId,
    "DENY",
    "L'operatore non vede il modulo di document intelligence.",
  );
  pushOverride(
    guestUser.id,
    agentManagementModuleId,
    "DENY",
    "L'operatore non vede il modulo agenti.",
  );
  pushOverride(
    guestUser.id,
    workflowManagementModuleId,
    "DENY",
    "L'operatore non vede il modulo workflow.",
  );
  pushOverride(
    guestUser.id,
    auditCenterModuleId,
    "DENY",
    "Il centro audit resta riservato al superadmin.",
  );

  const desiredOverrideKeys = new Set<string>();
  for (const [userId, entries] of desiredOverridesByUserId.entries()) {
    for (const entry of entries) {
      desiredOverrideKeys.add(`${userId}:${entry.moduleId}`);
      await prisma.userModuleOverride.upsert({
        where: {
          workspace_id_user_id_module_id: {
            workspace_id: workspace.id,
            user_id: userId,
            module_id: entry.moduleId,
          },
        },
        update: {
          mode: entry.mode,
          reason: entry.reason,
          configured_by_user_id: samuelUser.id,
          configured_at: new Date(),
        },
        create: {
          workspace_id: workspace.id,
          user_id: userId,
          module_id: entry.moduleId,
          mode: entry.mode,
          reason: entry.reason,
          configured_by_user_id: samuelUser.id,
        },
      });
    }
  }

  const existingOverrides = await prisma.userModuleOverride.findMany({
    where: {
      workspace_id: workspace.id,
      user_id: {
        in: [samuelUser.id, adminUser.id, guestUser.id],
      },
    },
    select: {
      user_id: true,
      module_id: true,
    },
  });

  const staleOverrideConditions = existingOverrides
    .filter((item) => !desiredOverrideKeys.has(`${item.user_id}:${item.module_id}`))
    .map((item) => ({
      workspace_id: workspace.id,
      user_id: item.user_id,
      module_id: item.module_id,
    }));

  if (staleOverrideConditions.length > 0) {
    await prisma.userModuleOverride.deleteMany({
      where: {
        OR: staleOverrideConditions,
      },
    });
  }

  const moduleAgentByRef = new Map<string, { id: string; moduleId: number }>();
  for (const prompt of DEFAULT_MODULE_AGENT_PROMPTS) {
    const module = moduleByKey.get(prompt.moduleKey);
    if (!module) {
      continue;
    }

    const agent = await prisma.moduleAgent.upsert({
      where: {
        workspace_id_module_id_key: {
          workspace_id: workspace.id,
          module_id: module.id,
          key: prompt.agentKey,
        },
      },
      update: {
        name: prompt.name,
        label: prompt.label,
        original_prompt: prompt.originalPrompt,
        is_enabled: true,
        updated_by_user_id: adminUser.id,
        deleted_at: null,
      },
      create: {
        workspace_id: workspace.id,
        module_id: module.id,
        key: prompt.agentKey,
        name: prompt.name,
        label: prompt.label,
        original_prompt: prompt.originalPrompt,
        active_prompt: prompt.originalPrompt,
        is_enabled: true,
        created_by_user_id: adminUser.id,
        updated_by_user_id: adminUser.id,
      },
      select: {
        id: true,
        module_id: true,
      },
    });

    moduleAgentByRef.set(`${prompt.moduleKey}:${prompt.agentKey}`, {
      id: agent.id,
      moduleId: agent.module_id,
    });
  }

  const moduleToolDefinitions = [
    {
      moduleKey: "document_intelligence",
      toolKey: "ocr_engine_extract_text",
      name: "ocr_engine_extract_text",
      label: "OCR engine PDF",
      description: "Estrae testo da un PDF tramite il modulo Python OCR condiviso.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "ocr_engine.extract_text_from_pdf_storage",
      inputSchema: {
        type: "object",
        required: ["storagePath"],
        properties: {
          storagePath: { type: "string" },
          fileName: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
      },
      configuration: {
        module: "ocr_engine",
        operation: "extract_text_from_pdf_storage",
      },
    },
    {
      moduleKey: "document_intelligence",
      toolKey: "knowledge_refresh_document",
      name: "knowledge_refresh_document",
      label: "Indicizza documento",
      description: "Aggiorna il knowledge layer e gli embedding di un documento archiviato.",
      runtimeKind: "BACKEND" as const,
      handlerKey: "document_intelligence.refresh_document_knowledge",
      inputSchema: {
        type: "object",
        required: ["documentId"],
        properties: {
          documentId: { type: "string", format: "uuid" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          knowledgeDocumentId: { type: "string", format: "uuid" },
          chunksCreated: { type: "integer" },
        },
      },
      configuration: {
        endpoint: "/api/knowledge/documents/:documentId/refresh",
      },
    },
    {
      moduleKey: "document_intelligence",
      toolKey: "semantic_knowledge_search",
      name: "semantic_knowledge_search",
      label: "Ricerca semantica knowledge",
      description: "Esegue semantic search sui knowledge chunks del workspace.",
      runtimeKind: "BACKEND" as const,
      handlerKey: "document_intelligence.search_workspace_knowledge",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          limit: { type: "integer" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          results: { type: "array" },
        },
      },
      configuration: {
        endpoint: "/api/knowledge/search",
      },
    },
    {
      moduleKey: "project_management",
      toolKey: "quotation_docx_builder",
      name: "quotation_docx_builder",
      label: "Generatore DOCX preventivo",
      description: "Genera il file Word finale a partire dai dati strutturati del preventivo.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "docx_engine.build_quotation_docx",
      inputSchema: {
        type: "object",
        required: ["structured_data"],
        properties: {
          structured_data: { type: "object" },
          file_name: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          file_name: { type: "string" },
          size_bytes: { type: "integer" },
          content_type: { type: "string" },
          docx_base64: { type: "string" },
        },
      },
      configuration: {
        module: "docx_engine",
        action: "build_quotation_docx",
      },
    },
    {
      moduleKey: "project_management",
      toolKey: "quotation_mail_delivery",
      name: "quotation_mail_delivery",
      label: "Invio mail preventivo",
      description: "Invia il preventivo generato tramite tool Python SMTP con allegato DOCX.",
      runtimeKind: "PYTHON_MODULE" as const,
      handlerKey: "mail_engine.send_quotation_email",
      inputSchema: {
        type: "object",
        required: ["to", "version_label", "file_name", "docx_base64"],
        properties: {
          to: { type: "string", format: "email" },
          client_name: { type: "string" },
          project_name: { type: "string" },
          version_label: { type: "string" },
          file_name: { type: "string" },
          docx_base64: { type: "string" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          to: { type: "string" },
          version_label: { type: "string" },
          file_name: { type: "string" },
          size_bytes: { type: "integer" },
          transport_result: {},
        },
      },
      configuration: {
        module: "mail_engine",
        action: "send_quotation_email",
      },
    },
  ];

  const moduleToolByRef = new Map<string, { id: string; moduleId: number }>();
  for (const definition of moduleToolDefinitions) {
    const module = moduleByKey.get(definition.moduleKey);
    if (!module) {
      continue;
    }

    const existingTool = await prisma.moduleTool.findFirst({
      where: {
        workspace_id: workspace.id,
        module_id: module.id,
        key: definition.toolKey,
      },
      select: {
        id: true,
      },
    });

    const tool = existingTool
      ? await prisma.moduleTool.update({
          where: {
            id: existingTool.id,
          },
          data: {
            name: definition.name,
            label: definition.label,
            description: definition.description,
            runtime_kind: definition.runtimeKind,
            handler_key: definition.handlerKey,
            input_schema: definition.inputSchema,
            output_schema: definition.outputSchema,
            configuration: definition.configuration,
            is_enabled: true,
            updated_by_user_id: adminUser.id,
            deleted_at: null,
          },
          select: {
            id: true,
            module_id: true,
          },
        })
      : await prisma.moduleTool.create({
          data: {
            workspace_id: workspace.id,
            module_id: module.id,
            key: definition.toolKey,
            name: definition.name,
            label: definition.label,
            description: definition.description,
            runtime_kind: definition.runtimeKind,
            handler_key: definition.handlerKey,
            input_schema: definition.inputSchema,
            output_schema: definition.outputSchema,
            configuration: definition.configuration,
            is_enabled: true,
            created_by_user_id: adminUser.id,
            updated_by_user_id: adminUser.id,
          },
          select: {
            id: true,
            module_id: true,
          },
        });

    moduleToolByRef.set(`${definition.moduleKey}:${definition.toolKey}`, {
      id: tool.id,
      moduleId: tool.module_id,
    });
  }

  const workflowDefinitions = [
    {
      moduleKey: "project_management",
      workflowKey: "quotation_document_pipeline",
      name: "quotation_document_pipeline",
      label: "Pipeline preventivo",
      description: "Workflow base per OCR, strutturazione preventivo, generazione DOCX e invio email.",
      isDefault: true,
      nodes: [
        {
          nodeKey: "quotation_pdf_input",
          nodeKind: "INPUT" as const,
          label: "PDF preventivo",
          positionX: 0,
          positionY: 80,
          isRequired: true,
          inputKind: "pdf",
          configuration: {
            acceptedMimeTypes: ["application/pdf"],
            isRequired: true,
          },
        },
        {
          nodeKey: "quotation_ocr_tool",
          nodeKind: "TOOL" as const,
          label: "OCR preventivo",
          positionX: 260,
          positionY: 80,
          isRequired: true,
          moduleToolRef: "document_intelligence:ocr_engine_extract_text",
          configuration: {
            stage: "ocr",
          },
        },
        {
          nodeKey: "quotation_structuring_agent",
          nodeKind: "AGENT" as const,
          label: "Agente strutturazione preventivo",
          positionX: 520,
          positionY: 80,
          isRequired: true,
          moduleAgentRef: "project_management:quotation_structuring_prompt",
          configuration: {
            purpose: "quotation_structuring",
          },
        },
        {
          nodeKey: "quotation_docx_builder_tool",
          nodeKind: "TOOL" as const,
          label: "Genera DOCX",
          positionX: 780,
          positionY: 30,
          isRequired: true,
          moduleToolRef: "project_management:quotation_docx_builder",
        },
        {
          nodeKey: "quotation_mail_delivery_tool",
          nodeKind: "TOOL" as const,
          label: "Invia mail preventivo",
          positionX: 780,
          positionY: 150,
          isRequired: false,
          moduleToolRef: "project_management:quotation_mail_delivery",
        },
        {
          nodeKey: "quotation_delivery_output",
          nodeKind: "OUTPUT" as const,
          label: "Esito preventivo",
          positionX: 1040,
          positionY: 90,
          isRequired: true,
          outputKind: "quotation_delivery",
          configuration: {
            persistenceTarget: "document_archive",
          },
        },
      ],
      edges: [
        { source: "quotation_pdf_input", target: "quotation_ocr_tool", orderNo: 1 },
        { source: "quotation_ocr_tool", target: "quotation_structuring_agent", orderNo: 2 },
        { source: "quotation_structuring_agent", target: "quotation_docx_builder_tool", orderNo: 3 },
        { source: "quotation_docx_builder_tool", target: "quotation_mail_delivery_tool", orderNo: 4 },
        { source: "quotation_mail_delivery_tool", target: "quotation_delivery_output", orderNo: 5 },
      ],
    },
    {
      moduleKey: "ddt_processing",
      workflowKey: "ddt_reader_pipeline",
      name: "ddt_reader_pipeline",
      label: "Pipeline DDT Reader",
      description: "Workflow base per OCR, analisi DDT e indicizzazione knowledge finale.",
      isDefault: true,
      nodes: [
        {
          nodeKey: "ddt_pdf_input",
          nodeKind: "INPUT" as const,
          label: "PDF DDT",
          positionX: 0,
          positionY: 80,
          isRequired: true,
          inputKind: "pdf",
          configuration: {
            acceptedMimeTypes: ["application/pdf"],
            isRequired: true,
          },
        },
        {
          nodeKey: "ddt_ocr_tool",
          nodeKind: "TOOL" as const,
          label: "OCR DDT",
          positionX: 250,
          positionY: 80,
          isRequired: true,
          moduleToolRef: "document_intelligence:ocr_engine_extract_text",
        },
        {
          nodeKey: "ddt_analysis_agent",
          nodeKind: "AGENT" as const,
          label: "Agente analisi DDT",
          positionX: 500,
          positionY: 80,
          isRequired: true,
          moduleAgentRef: "ddt_processing:ddt_analysis_prompt",
        },
        {
          nodeKey: "ddt_knowledge_index_tool",
          nodeKind: "TOOL" as const,
          label: "Indicizza knowledge",
          positionX: 760,
          positionY: 80,
          isRequired: true,
          moduleToolRef: "document_intelligence:knowledge_refresh_document",
        },
        {
          nodeKey: "ddt_analysis_output",
          nodeKind: "OUTPUT" as const,
          label: "Esito analisi DDT",
          positionX: 1020,
          positionY: 80,
          isRequired: true,
          outputKind: "ddt_analysis_result",
          configuration: {
            persistenceTarget: "ddt_processing",
          },
        },
      ],
      edges: [
        { source: "ddt_pdf_input", target: "ddt_ocr_tool", orderNo: 1 },
        { source: "ddt_ocr_tool", target: "ddt_analysis_agent", orderNo: 2 },
        { source: "ddt_analysis_agent", target: "ddt_knowledge_index_tool", orderNo: 3 },
        { source: "ddt_knowledge_index_tool", target: "ddt_analysis_output", orderNo: 4 },
      ],
    },
  ];

  for (const definition of workflowDefinitions) {
    const module = moduleByKey.get(definition.moduleKey);
    if (!module) {
      continue;
    }

    const existingWorkflow = await prisma.moduleWorkflow.findFirst({
      where: {
        workspace_id: workspace.id,
        module_id: module.id,
        key: definition.workflowKey,
      },
      select: {
        id: true,
      },
    });

    const workflow = existingWorkflow
      ? await prisma.moduleWorkflow.update({
          where: {
            id: existingWorkflow.id,
          },
          data: {
            name: definition.name,
            label: definition.label,
            description: definition.description,
            version_no: 1,
            is_enabled: true,
            is_default: definition.isDefault,
            updated_by_user_id: adminUser.id,
            deleted_at: null,
          },
          select: {
            id: true,
          },
        })
      : await prisma.moduleWorkflow.create({
          data: {
            workspace_id: workspace.id,
            module_id: module.id,
            key: definition.workflowKey,
            name: definition.name,
            label: definition.label,
            description: definition.description,
            version_no: 1,
            is_enabled: true,
            is_default: definition.isDefault,
            created_by_user_id: adminUser.id,
            updated_by_user_id: adminUser.id,
          },
          select: {
            id: true,
          },
        });

    const workflowNodeByKey = new Map<string, { id: string }>();
    for (const node of definition.nodes) {
      const moduleAgent = "moduleAgentRef" in node && node.moduleAgentRef ? moduleAgentByRef.get(node.moduleAgentRef) : null;
      const moduleTool = "moduleToolRef" in node && node.moduleToolRef ? moduleToolByRef.get(node.moduleToolRef) : null;

      const existingNode = await prisma.moduleWorkflowNode.findFirst({
        where: {
          workflow_id: workflow.id,
          node_key: node.nodeKey,
        },
        select: {
          id: true,
        },
      });

      const savedNode = existingNode
        ? await prisma.moduleWorkflowNode.update({
            where: {
              id: existingNode.id,
            },
            data: {
              node_kind: node.nodeKind,
              label: node.label,
              position_x: node.positionX,
              position_y: node.positionY,
              module_agent_id: moduleAgent?.id ?? null,
              module_tool_id: moduleTool?.id ?? null,
              input_kind: "inputKind" in node ? node.inputKind ?? null : null,
              output_kind: "outputKind" in node ? node.outputKind ?? null : null,
              configuration: node.configuration ?? null,
              is_required: "isRequired" in node ? node.isRequired ?? false : false,
              is_enabled: true,
            },
            select: {
              id: true,
            },
          })
        : await prisma.moduleWorkflowNode.create({
            data: {
              workflow_id: workflow.id,
              workspace_id: workspace.id,
              node_key: node.nodeKey,
              node_kind: node.nodeKind,
              label: node.label,
              position_x: node.positionX,
              position_y: node.positionY,
              module_agent_id: moduleAgent?.id ?? null,
              module_tool_id: moduleTool?.id ?? null,
              input_kind: "inputKind" in node ? node.inputKind ?? null : null,
              output_kind: "outputKind" in node ? node.outputKind ?? null : null,
              configuration: node.configuration ?? null,
              is_required: "isRequired" in node ? node.isRequired ?? false : false,
              is_enabled: true,
            },
            select: {
              id: true,
            },
          });

      workflowNodeByKey.set(node.nodeKey, savedNode);
    }

    await prisma.moduleWorkflowEdge.deleteMany({
      where: {
        workflow_id: workflow.id,
      },
    });

    await prisma.moduleWorkflowEdge.createMany({
      data: definition.edges.map((edge) => {
        const sourceNode = workflowNodeByKey.get(edge.source);
        const targetNode = workflowNodeByKey.get(edge.target);
        if (!sourceNode || !targetNode) {
          throw new Error(`Workflow edge non valido per ${definition.workflowKey}: ${edge.source} -> ${edge.target}`);
        }

        return {
          workspace_id: workspace.id,
          workflow_id: workflow.id,
          source_node_id: sourceNode.id,
          target_node_id: targetNode.id,
          order_no: edge.orderNo,
          is_enabled: true,
        };
      }),
    });
  }

  console.log("Seed completed:", {
    organization: organization.code,
    workspace: workspace.code,
    users: accountDefinitions.map((item) => ({
      email: item.email,
      role: item.roleKey,
      password: "admin",
    })),
    modules: MODULE_KEYS.length,
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
