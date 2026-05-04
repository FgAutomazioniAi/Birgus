import { randomBytes, scrypt } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MODULE_KEYS = [
  "project_management",
  "shipment_management",
  "ddt_processing",
  "document_archive",
  "notification_center",
] as const;

const ROLE_KEYS = ["superadmin", "admin", "operator"] as const;

const PERMISSION_KEYS = [
  "modules.read",
  "modules.configure",
  "projects.read",
  "projects.write",
  "clients.read",
  "clients.write",
  "documents.read",
  "documents.write",
  "shipments.read",
  "shipments.write",
  "ddt.read",
  "ddt.process",
  "notifications.read",
  "notifications.write",
] as const;

const ROLE_PERMISSION_MATRIX: Record<(typeof ROLE_KEYS)[number], readonly (typeof PERMISSION_KEYS)[number][]> = {
  superadmin: PERMISSION_KEYS,
  admin: PERMISSION_KEYS,
  operator: [
    "modules.read",
    "projects.read",
    "projects.write",
    "clients.read",
    "clients.write",
    "documents.read",
    "documents.write",
    "shipments.read",
    "shipments.write",
    "ddt.read",
    "ddt.process",
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
  if (!superadminRole) {
    throw new Error("Role 'superadmin' not found after seed role creation.");
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

  const adminEmail = "superuser@birgus.it";
  const adminPasswordHash = await hashPassword("admin");

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      first_name: "Super",
      last_name: "Admin",
      password_hash: adminPasswordHash,
      is_active: true,
    },
    create: {
      email: adminEmail,
      first_name: "Super",
      last_name: "Admin",
      password_hash: adminPasswordHash,
      is_active: true,
    },
  });

  await prisma.workspaceMembership.upsert({
    where: {
      workspace_id_user_id: {
        workspace_id: workspace.id,
        user_id: adminUser.id,
      },
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      workspace_id: workspace.id,
      user_id: adminUser.id,
      status: "ACTIVE",
    },
  });

  await prisma.userWorkspaceRole.upsert({
    where: {
      workspace_id_user_id_role_id: {
        workspace_id: workspace.id,
        user_id: adminUser.id,
        role_id: superadminRole.id,
      },
    },
    update: {},
    create: {
      workspace_id: workspace.id,
      user_id: adminUser.id,
      role_id: superadminRole.id,
    },
  });

  await prisma.userPreference.upsert({
    where: {
      user_id_workspace_id: {
        user_id: adminUser.id,
        workspace_id: workspace.id,
      },
    },
    update: {
      palette_id: "predefinito",
      language_code: "it",
    },
    create: {
      user_id: adminUser.id,
      workspace_id: workspace.id,
      palette_id: "predefinito",
      language_code: "it",
      rows_projects: 20,
      rows_clients: 20,
    },
  });

  const samuelEmail = "samuel.m@fgautomazioni.it";
  const samuelPasswordHash = await hashPassword("admin");

  const samuelUser = await prisma.user.upsert({
    where: { email: samuelEmail },
    update: {
      first_name: "Samuel",
      last_name: "M",
      password_hash: samuelPasswordHash,
      is_active: true,
    },
    create: {
      email: samuelEmail,
      first_name: "Samuel",
      last_name: "M",
      password_hash: samuelPasswordHash,
      is_active: true,
    },
  });

  await prisma.workspaceMembership.upsert({
    where: {
      workspace_id_user_id: {
        workspace_id: workspace.id,
        user_id: samuelUser.id,
      },
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      workspace_id: workspace.id,
      user_id: samuelUser.id,
      status: "ACTIVE",
    },
  });

  await prisma.userWorkspaceRole.upsert({
    where: {
      workspace_id_user_id_role_id: {
        workspace_id: workspace.id,
        user_id: samuelUser.id,
        role_id: superadminRole.id,
      },
    },
    update: {},
    create: {
      workspace_id: workspace.id,
      user_id: samuelUser.id,
      role_id: superadminRole.id,
    },
  });

  await prisma.userPreference.upsert({
    where: {
      user_id_workspace_id: {
        user_id: samuelUser.id,
        workspace_id: workspace.id,
      },
    },
    update: {
      palette_id: "predefinito",
      language_code: "it",
    },
    create: {
      user_id: samuelUser.id,
      workspace_id: workspace.id,
      palette_id: "predefinito",
      language_code: "it",
      rows_projects: 20,
      rows_clients: 20,
    },
  });

  console.log("Seed completed:", {
    organization: organization.code,
    workspace: workspace.code,
    adminEmail,
    samuelEmail,
    adminPassword: "admin",
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
