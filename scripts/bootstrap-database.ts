import { randomBytes, scrypt } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MODULE_KEYS = [
  "project_management",
  "agent_management",
  "shipment_management",
  "ddt_processing",
  "measure_report",
  "document_archive",
  "document_intelligence",
  "conversational_assistant",
  "ai_runtime_control",
  "workflow_management",
  "customer_map",
  "offer_priority",
  "maintenance_proposals",
  "maintenance_calendar",
  "notification_center",
  "audit_center",
  "superadmin_center",
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
  "measure_report.read",
  "measure_report.process",
  "knowledge.read",
  "knowledge.write",
  "assistant.read",
  "assistant.write",
  "assistant.configure",
  "workflows.read",
  "workflows.write",
  "workflows.configure",
  "customer_map.read",
  "customer_map.write",
  "offer_priority.read",
  "offer_priority.write",
  "maintenance_proposals.read",
  "maintenance_proposals.write",
  "maintenance_calendar.read",
  "maintenance_calendar.write",
  "notifications.read",
  "notifications.write",
  "audit.read",
] as const;

const ROLE_PERMISSION_MATRIX: Record<(typeof ROLE_KEYS)[number], readonly (typeof PERMISSION_KEYS)[number][]> = {
  superadmin: PERMISSION_KEYS,
  admin: PERMISSION_KEYS.filter((permission) => permission !== "audit.read"),
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
    "measure_report.read",
    "measure_report.process",
    "knowledge.read",
    "assistant.read",
    "assistant.write",
    "workflows.read",
    "customer_map.read",
    "offer_priority.read",
    "maintenance_proposals.read",
    "maintenance_calendar.read",
    "notifications.read",
  ],
};

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

const MODULE_DEPENDENCIES = [
  ["agent_management", "project_management"],
  ["document_intelligence", "document_archive"],
  ["conversational_assistant", "document_intelligence"],
  ["workflow_management", "agent_management"],
  ["workflow_management", "document_intelligence"],
  ["audit_center", "notification_center"],
] as const;

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

function readBootstrapPassword(): string {
  const password = process.env.BIRGUS_BOOTSTRAP_PASSWORD?.trim()
    ?? process.env.BIRGUS_SEED_PASSWORD?.trim()
    ?? "";
  if (password.length < 12) {
    throw new Error("BIRGUS_BOOTSTRAP_PASSWORD or BIRGUS_SEED_PASSWORD is required and must be at least 12 characters.");
  }
  return password;
}

async function main() {
  const organizationCode = process.env.BIRGUS_BOOTSTRAP_ORGANIZATION_CODE?.trim() || "birgus";
  const organizationName = process.env.BIRGUS_BOOTSTRAP_ORGANIZATION_NAME?.trim() || "Birgus Platform";
  const workspaceCode = process.env.BIRGUS_BOOTSTRAP_WORKSPACE_CODE?.trim() || "main";
  const workspaceName = process.env.BIRGUS_BOOTSTRAP_WORKSPACE_NAME?.trim() || "Main Workspace";
  const bootstrapEmail = (process.env.BIRGUS_BOOTSTRAP_EMAIL?.trim() || "admin@birgus.local").toLowerCase();
  const bootstrapFirstName = process.env.BIRGUS_BOOTSTRAP_FIRST_NAME?.trim() || "Birgus";
  const bootstrapLastName = process.env.BIRGUS_BOOTSTRAP_LAST_NAME?.trim() || "Admin";

  const organization = await prisma.organization.upsert({
    where: { code: organizationCode },
    update: {
      legal_name: organizationName,
      deleted_at: null,
    },
    create: {
      code: organizationCode,
      legal_name: organizationName,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: {
      organization_id_code: {
        organization_id: organization.id,
        code: workspaceCode,
      },
    },
    update: {
      name: workspaceName,
      is_active: true,
      deleted_at: null,
    },
    create: {
      organization_id: organization.id,
      code: workspaceCode,
      name: workspaceName,
      is_active: true,
    },
  });

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

  const roles = await prisma.role.findMany({ where: { key: { in: [...ROLE_KEYS] } } });
  const permissions = await prisma.permission.findMany({ where: { key: { in: [...PERMISSION_KEYS] } } });
  const roleByKey = new Map(roles.map((role) => [role.key, role]));
  const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));

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

  for (const moduleKey of MODULE_KEYS) {
    await prisma.module.upsert({
      where: { key: moduleKey },
      update: { name: moduleKey, is_active: true },
      create: { key: moduleKey, name: moduleKey, is_active: true },
    });
  }

  const modules = await prisma.module.findMany({ where: { key: { in: [...MODULE_KEYS] } } });
  const moduleByKey = new Map(modules.map((module) => [module.key, module]));

  for (const module of modules) {
    await prisma.workspaceModule.upsert({
      where: {
        workspace_id_module_id: {
          workspace_id: workspace.id,
          module_id: module.id,
        },
      },
      update: {},
      create: {
        workspace_id: workspace.id,
        module_id: module.id,
        is_enabled: true,
      },
    });
  }

  for (const [moduleKey, dependsOnModuleKey] of MODULE_DEPENDENCIES) {
    const module = moduleByKey.get(moduleKey);
    const dependsOnModule = moduleByKey.get(dependsOnModuleKey);
    if (!module || !dependsOnModule) {
      continue;
    }
    await prisma.moduleDependency.upsert({
      where: {
        module_id_depends_on_module_id: {
          module_id: module.id,
          depends_on_module_id: dependsOnModule.id,
        },
      },
      update: {},
      create: {
        module_id: module.id,
        depends_on_module_id: dependsOnModule.id,
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
      update: {},
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
      update: {},
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
      where: { key: fileType.key },
      update: {},
      create: {
        key: fileType.key,
        mime_type: fileType.mimeType,
      },
    });
  }

  for (const fileStatus of FILE_STATUSES) {
    await prisma.fileStatus.upsert({
      where: { key: fileStatus },
      update: {},
      create: { key: fileStatus },
    });
  }

  const superadminRole = roleByKey.get("superadmin");
  if (!superadminRole) {
    throw new Error("Superadmin role not found after bootstrap.");
  }

  const existingSuperadmin = await prisma.userWorkspaceRole.findFirst({
    where: {
      role: {
        key: "superadmin",
      },
      user: {
        deleted_at: null,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existingSuperadmin) {
    const passwordHash = await hashPassword(readBootstrapPassword());
    const user = await prisma.user.upsert({
      where: { email: bootstrapEmail },
      update: {
        first_name: bootstrapFirstName,
        last_name: bootstrapLastName,
        password_hash: passwordHash,
        password_updated_at: new Date(),
        must_change_password: true,
        is_active: true,
        deleted_at: null,
      },
      create: {
        email: bootstrapEmail,
        first_name: bootstrapFirstName,
        last_name: bootstrapLastName,
        password_hash: passwordHash,
        must_change_password: true,
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
        left_at: null,
      },
      create: {
        workspace_id: workspace.id,
        user_id: user.id,
        status: "ACTIVE",
      },
    });

    await prisma.userWorkspaceRole.upsert({
      where: {
        workspace_id_user_id_role_id: {
          workspace_id: workspace.id,
          user_id: user.id,
          role_id: superadminRole.id,
        },
      },
      update: {},
      create: {
        workspace_id: workspace.id,
        user_id: user.id,
        role_id: superadminRole.id,
      },
    });

    await prisma.userPreference.upsert({
      where: {
        user_id_workspace_id: {
          user_id: user.id,
          workspace_id: workspace.id,
        },
      },
      update: {},
      create: {
        user_id: user.id,
        workspace_id: workspace.id,
        palette_id: "predefinito",
        language_code: "it",
      },
    });

    console.log("Database bootstrap created first superadmin:", { email: user.email });
  } else {
    console.log("Database bootstrap kept existing superadmin.");
  }

  console.log("Database bootstrap completed:", {
    organization: organization.code,
    workspace: workspace.code,
    modules: modules.length,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
