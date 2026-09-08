import { PrismaClient } from "@prisma/client";
import { ensureCommissionIntakeSystemTemplate } from "../prisma/commission-intake-template.js";

const prisma = new PrismaClient();
const MODULE_KEYS = ["project_management", "agent_management", "ddt_processing", "measure_report", "document_archive", "document_intelligence", "conversational_assistant", "ai_runtime_control", "workflow_management", "commission_registry", "commission_intake", "customer_map", "offer_priority", "maintenance_proposals", "maintenance_calendar", "notification_center", "audit_center", "superadmin_center"] as const;
const ROLE_KEYS = ["developer", "superuser", "admin", "operator"] as const;
const PERMISSION_KEYS = ["modules.read", "modules.configure", "projects.read", "projects.write", "agents.read", "agents.write", "clients.read", "clients.write", "documents.read", "documents.write", "ddt.read", "ddt.process", "measure_report.read", "measure_report.process", "knowledge.read", "knowledge.write", "assistant.read", "assistant.write", "assistant.configure", "workflows.read", "workflows.write", "workflows.configure", "commission_registry.read", "commission_registry.write", "commission_registry.configure", "commission_intake.read", "commission_intake.write", "commission_intake.configure", "customer_map.read", "customer_map.write", "offer_priority.read", "offer_priority.write", "maintenance_proposals.read", "maintenance_proposals.write", "maintenance_calendar.read", "maintenance_calendar.write", "notifications.read", "notifications.write", "audit.read"] as const;
const ROLE_PERMISSIONS: Record<(typeof ROLE_KEYS)[number], readonly (typeof PERMISSION_KEYS)[number][]> = {
  developer: PERMISSION_KEYS,
  superuser: PERMISSION_KEYS,
  admin: PERMISSION_KEYS.filter((key) => key !== "audit.read"),
  operator: ["modules.read", "projects.read", "projects.write", "agents.read", "agents.write", "clients.read", "clients.write", "documents.read", "documents.write", "ddt.read", "ddt.process", "measure_report.read", "measure_report.process", "knowledge.read", "assistant.read", "assistant.write", "workflows.read", "commission_registry.read", "commission_registry.write", "commission_intake.read", "commission_intake.write", "customer_map.read", "offer_priority.read", "maintenance_proposals.read", "maintenance_calendar.read", "notifications.read"],
};
const ROLE_LABELS: Record<(typeof ROLE_KEYS)[number], string> = {
  developer: "Developer",
  superuser: "Superuser",
  admin: "Admin",
  operator: "Operatore",
};
const MODULE_DEPENDENCIES = [["document_intelligence", "document_archive"], ["conversational_assistant", "document_intelligence"], ["workflow_management", "agent_management"], ["workflow_management", "document_intelligence"], ["commission_intake", "commission_registry"], ["audit_center", "notification_center"]] as const;
const MODULE_LABELS: Record<(typeof MODULE_KEYS)[number], string> = {
  project_management: "Progetti",
  agent_management: "Agenti",
  ddt_processing: "DDT Reader",
  measure_report: "Measure Report",
  document_archive: "Archivio",
  document_intelligence: "Knowledge documentale",
  conversational_assistant: "Assistente conversazionale",
  ai_runtime_control: "Provider AI",
  workflow_management: "Workflow",
  commission_registry: "Anagrafica commesse",
  commission_intake: "Checklist raccolta dati",
  customer_map: "Mappa clienti",
  offer_priority: "Priorita offerte",
  maintenance_proposals: "Proposte manutenzione",
  maintenance_calendar: "Calendario manutenzioni",
  notification_center: "Notifiche",
  audit_center: "Audit",
  superadmin_center: "Gestione workspace",
};

async function syncRolePermissions(
  roleByKey: Map<string, { id: number; key: string }>,
  permissionByKey: Map<string, { id: number; key: string }>,
): Promise<void> {
  const desiredPairs = new Set(
    ROLE_KEYS.flatMap((roleKey) => ROLE_PERMISSIONS[roleKey].map((permissionKey) => `${roleKey}:${permissionKey}`)),
  );
  const existingPairs = await prisma.rolePermission.findMany({
    where: {
      role: { key: { in: [...ROLE_KEYS] } },
      permission: { key: { in: [...PERMISSION_KEYS] } },
    },
    include: {
      role: { select: { key: true } },
      permission: { select: { key: true } },
    },
  });

  for (const pair of existingPairs) {
    const key = `${pair.role.key}:${pair.permission.key}`;
    if (!desiredPairs.has(key)) {
      await prisma.rolePermission.delete({ where: { id: pair.id } });
    }
  }

  for (const roleKey of ROLE_KEYS) {
    const role = roleByKey.get(roleKey);
    if (!role) continue;
    for (const permissionKey of ROLE_PERMISSIONS[roleKey]) {
      const permission = permissionByKey.get(permissionKey);
      if (permission) await prisma.rolePermission.upsert({ where: { role_id_permission_id: { role_id: role.id, permission_id: permission.id } }, update: {}, create: { role_id: role.id, permission_id: permission.id } });
    }
  }
}

async function syncManagedModuleDependencies(moduleByKey: Map<string, { id: number; key: string }>): Promise<void> {
  const managedKeys = [...MODULE_KEYS];
  const desiredPairs = new Set(MODULE_DEPENDENCIES.map(([moduleKey, dependencyKey]) => `${moduleKey}:${dependencyKey}`));
  const existingPairs = await prisma.moduleDependency.findMany({
    where: {
      module: { key: { in: managedKeys } },
      depends_on_module: { key: { in: managedKeys } },
    },
    include: {
      module: { select: { key: true } },
      depends_on_module: { select: { key: true } },
    },
  });

  for (const dependency of existingPairs) {
    const key = `${dependency.module.key}:${dependency.depends_on_module.key}`;
    if (!desiredPairs.has(key)) {
      await prisma.moduleDependency.delete({ where: { id: dependency.id } });
    }
  }

  for (const [moduleKey, dependencyKey] of MODULE_DEPENDENCIES) {
    const module = moduleByKey.get(moduleKey);
    const dependency = moduleByKey.get(dependencyKey);
    if (module && dependency) await prisma.moduleDependency.upsert({ where: { module_id_depends_on_module_id: { module_id: module.id, depends_on_module_id: dependency.id } }, update: {}, create: { module_id: module.id, depends_on_module_id: dependency.id } });
  }
}

async function ensureWorkspaceModuleRows(modules: Array<{ id: number }>): Promise<void> {
  const workspaces = await prisma.workspace.findMany({
    where: { deleted_at: null },
    select: { id: true },
  });

  for (const workspace of workspaces) {
    await prisma.workspaceModule.createMany({
      data: modules.map((module) => ({
        workspace_id: workspace.id,
        module_id: module.id,
        is_enabled: false,
      })),
      skipDuplicates: true,
    });
  }
}

async function main(): Promise<void> {
  for (const key of ROLE_KEYS) await prisma.role.upsert({ where: { key }, update: { label: ROLE_LABELS[key], is_system: true }, create: { key, label: ROLE_LABELS[key], is_system: true } });
  const legacyRole = await prisma.role.findUnique({ where: { key: "superadmin" }, select: { id: true } });
  if (legacyRole) {
    const [legacyAssignments, developerRole, superuserRole, existingDeveloperAssignments] = await Promise.all([
      prisma.userWorkspaceRole.findMany({
        where: { role_id: legacyRole.id },
        select: { workspace_id: true, user_id: true, user: { select: { email: true, two_factor_enabled: true } } },
      }),
      prisma.role.findUniqueOrThrow({ where: { key: "developer" }, select: { id: true } }),
      prisma.role.findUniqueOrThrow({ where: { key: "superuser" }, select: { id: true } }),
      prisma.userWorkspaceRole.findMany({ where: { role: { key: "developer" } }, select: { user_id: true } }),
    ]);
    const existingDeveloperUserIds = [...new Set(existingDeveloperAssignments.map((assignment) => assignment.user_id))];
    if (existingDeveloperUserIds.length > 1) throw new Error("Multiple Developer accounts already exist. Resolve the assignments before bootstrap.");

    const legacyUsers = [...new Map(legacyAssignments.map((assignment) => [assignment.user_id, assignment.user])).entries()];
    const configuredDeveloperEmail = process.env.BIRGUS_DEVELOPER_EMAIL?.trim().toLowerCase() ?? "";
    const configuredDeveloper = configuredDeveloperEmail
      ? legacyUsers.find(([, user]) => user.email.toLowerCase() === configuredDeveloperEmail)
      : null;
    if (configuredDeveloperEmail && !configuredDeveloper) {
      throw new Error(`BIRGUS_DEVELOPER_EMAIL '${configuredDeveloperEmail}' is not assigned to the legacy superadmin role.`);
    }
    if (configuredDeveloper && existingDeveloperUserIds[0] && existingDeveloperUserIds[0] !== configuredDeveloper[0]) {
      throw new Error("BIRGUS_DEVELOPER_EMAIL does not match the existing Developer account.");
    }

    const twoFactorCandidates = legacyUsers.filter(([, user]) => user.two_factor_enabled);
    const developerUserId = configuredDeveloper?.[0]
      ?? existingDeveloperUserIds[0]
      ?? (twoFactorCandidates.length === 1 ? twoFactorCandidates[0][0] : undefined)
      ?? (legacyUsers.length === 1 ? legacyUsers[0][0] : undefined);
    if (!developerUserId) {
      throw new Error("Legacy superadmin migration requires BIRGUS_DEVELOPER_EMAIL because multiple candidates exist.");
    }

    await prisma.$transaction(async (tx) => {
      for (const assignment of legacyAssignments) {
        const targetRoleId = assignment.user_id === developerUserId ? developerRole.id : superuserRole.id;
        await tx.userWorkspaceRole.deleteMany({
          where: {
            workspace_id: assignment.workspace_id,
            user_id: assignment.user_id,
            role_id: assignment.user_id === developerUserId ? superuserRole.id : developerRole.id,
          },
        });
        await tx.userWorkspaceRole.upsert({
          where: { workspace_id_user_id_role_id: { workspace_id: assignment.workspace_id, user_id: assignment.user_id, role_id: targetRoleId } },
          update: {},
          create: { workspace_id: assignment.workspace_id, user_id: assignment.user_id, role_id: targetRoleId },
        });
      }
      await tx.userWorkspaceRole.deleteMany({ where: { role_id: legacyRole.id } });
      await tx.rolePermission.deleteMany({ where: { role_id: legacyRole.id } });
      await tx.role.delete({ where: { id: legacyRole.id } });
    });
    console.log(`Migrated ${legacyUsers.length} legacy superadmin account(s): 1 Developer, ${Math.max(legacyUsers.length - 1, 0)} Superuser.`);
  }
  for (const key of PERMISSION_KEYS) await prisma.permission.upsert({ where: { key }, update: { label: key }, create: { key, label: key } });
  const [roles, permissions] = await Promise.all([prisma.role.findMany({ where: { key: { in: [...ROLE_KEYS] } } }), prisma.permission.findMany({ where: { key: { in: [...PERMISSION_KEYS] } } })]);
  const roleByKey = new Map(roles.map((item) => [item.key, item]));
  const permissionByKey = new Map(permissions.map((item) => [item.key, item]));
  await syncRolePermissions(roleByKey, permissionByKey);
  for (const key of MODULE_KEYS) await prisma.module.upsert({ where: { key }, update: { name: MODULE_LABELS[key], is_active: true }, create: { key, name: MODULE_LABELS[key], is_active: true } });
  await ensureCommissionIntakeSystemTemplate(prisma);
  const modules = await prisma.module.findMany({ where: { key: { in: [...MODULE_KEYS] } } });
  const moduleByKey = new Map(modules.map((item) => [item.key, item]));
  await syncManagedModuleDependencies(moduleByKey);
  await ensureWorkspaceModuleRows(modules);
  for (const [key, mimeType] of [["pdf", "application/pdf"], ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]] as const) await prisma.fileType.upsert({ where: { key }, update: { mime_type: mimeType }, create: { key, mime_type: mimeType } });
  for (const key of ["uploaded", "reviewed", "approved"]) await prisma.fileStatus.upsert({ where: { key }, update: {}, create: { key } });
  console.log(`System catalog ready: ${modules.length} modules, ${roles.length} roles. No workspace or user was created.`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
