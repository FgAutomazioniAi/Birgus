import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MODULE_KEYS = ["project_management", "agent_management", "ddt_processing", "measure_report", "document_archive", "document_intelligence", "conversational_assistant", "ai_runtime_control", "workflow_management", "customer_map", "offer_priority", "maintenance_proposals", "maintenance_calendar", "notification_center", "audit_center", "superadmin_center"] as const;
const ROLE_KEYS = ["superadmin", "admin", "operator"] as const;
const PERMISSION_KEYS = ["modules.read", "modules.configure", "projects.read", "projects.write", "agents.read", "agents.write", "clients.read", "clients.write", "documents.read", "documents.write", "ddt.read", "ddt.process", "measure_report.read", "measure_report.process", "knowledge.read", "knowledge.write", "assistant.read", "assistant.write", "assistant.configure", "workflows.read", "workflows.write", "workflows.configure", "customer_map.read", "customer_map.write", "offer_priority.read", "offer_priority.write", "maintenance_proposals.read", "maintenance_proposals.write", "maintenance_calendar.read", "maintenance_calendar.write", "notifications.read", "notifications.write", "audit.read"] as const;
const ROLE_PERMISSIONS: Record<(typeof ROLE_KEYS)[number], readonly (typeof PERMISSION_KEYS)[number][]> = {
  superadmin: PERMISSION_KEYS,
  admin: PERMISSION_KEYS.filter((key) => key !== "audit.read"),
  operator: ["modules.read", "projects.read", "projects.write", "agents.read", "agents.write", "clients.read", "clients.write", "documents.read", "documents.write", "ddt.read", "ddt.process", "measure_report.read", "measure_report.process", "knowledge.read", "assistant.read", "assistant.write", "workflows.read", "customer_map.read", "offer_priority.read", "maintenance_proposals.read", "maintenance_calendar.read", "notifications.read"],
};
const MODULE_DEPENDENCIES = [["document_intelligence", "document_archive"], ["conversational_assistant", "document_intelligence"], ["workflow_management", "agent_management"], ["workflow_management", "document_intelligence"], ["audit_center", "notification_center"]] as const;

async function main(): Promise<void> {
  for (const key of ROLE_KEYS) await prisma.role.upsert({ where: { key }, update: { label: key, is_system: true }, create: { key, label: key, is_system: true } });
  for (const key of PERMISSION_KEYS) await prisma.permission.upsert({ where: { key }, update: { label: key }, create: { key, label: key } });
  const [roles, permissions] = await Promise.all([prisma.role.findMany({ where: { key: { in: [...ROLE_KEYS] } } }), prisma.permission.findMany({ where: { key: { in: [...PERMISSION_KEYS] } } })]);
  const roleByKey = new Map(roles.map((item) => [item.key, item]));
  const permissionByKey = new Map(permissions.map((item) => [item.key, item]));
  for (const roleKey of ROLE_KEYS) {
    const role = roleByKey.get(roleKey);
    if (!role) continue;
    for (const permissionKey of ROLE_PERMISSIONS[roleKey]) {
      const permission = permissionByKey.get(permissionKey);
      if (permission) await prisma.rolePermission.upsert({ where: { role_id_permission_id: { role_id: role.id, permission_id: permission.id } }, update: {}, create: { role_id: role.id, permission_id: permission.id } });
    }
  }
  for (const key of MODULE_KEYS) await prisma.module.upsert({ where: { key }, update: { name: key, is_active: true }, create: { key, name: key, is_active: true } });
  const modules = await prisma.module.findMany({ where: { key: { in: [...MODULE_KEYS] } } });
  const moduleByKey = new Map(modules.map((item) => [item.key, item]));
  await prisma.moduleDependency.deleteMany({ where: { module: { key: "agent_management" }, depends_on_module: { key: "project_management" } } });
  for (const [moduleKey, dependencyKey] of MODULE_DEPENDENCIES) {
    const module = moduleByKey.get(moduleKey);
    const dependency = moduleByKey.get(dependencyKey);
    if (module && dependency) await prisma.moduleDependency.upsert({ where: { module_id_depends_on_module_id: { module_id: module.id, depends_on_module_id: dependency.id } }, update: {}, create: { module_id: module.id, depends_on_module_id: dependency.id } });
  }
  for (const [key, mimeType] of [["pdf", "application/pdf"], ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]] as const) await prisma.fileType.upsert({ where: { key }, update: { mime_type: mimeType }, create: { key, mime_type: mimeType } });
  for (const key of ["uploaded", "reviewed", "approved"]) await prisma.fileStatus.upsert({ where: { key }, update: {}, create: { key } });
  console.log(`System catalog ready: ${modules.length} modules, ${roles.length} roles. No workspace or user was created.`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
