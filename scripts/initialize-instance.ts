import { randomBytes, scrypt } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { createInstallationProfile, hashInstallationProfile } from "./installation-profile.js";
import { activationGroupFor } from "../src/modules/module-management/domain/ModuleActivationGroups.js";

const prisma = new PrismaClient();
const usage = "npm run instance:initialize -- --organization-code <code> --organization-name <name> --workspace-code <code> --workspace-name <name> --email <email> --first-name <name> --password <password> --modules <comma-separated-module-keys>";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1]?.trim() : "";
  if (!value) throw new Error(`Missing ${name}.\n${usage}`);
  return value;
}

function code(value: string, label: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalized)) throw new Error(`${label} must use lowercase letters, numbers and hyphens only.`);
  return normalized;
}

async function passwordHash(password: string): Promise<string> {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) throw new Error("The temporary password must be at least 8 characters and contain an uppercase letter and a number.");
  const pepper = process.env.AUTH_PEPPER?.trim();
  if (!pepper) throw new Error("AUTH_PEPPER is not configured in the app container.");
  const salt = randomBytes(16).toString("base64url");
  const derived = await new Promise<Buffer>((resolve, reject) => scrypt(password.normalize("NFKC") + pepper, salt, 64, { N: 16384, p: 1, r: 8 }, (error, value) => error ? reject(error) : resolve(value)));
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) { console.log(usage); return; }
  const organizationCode = code(argument("--organization-code"), "Organization code");
  const workspaceCode = code(argument("--workspace-code"), "Workspace code");
  const organizationName = argument("--organization-name");
  const workspaceName = argument("--workspace-name");
  const email = argument("--email").toLowerCase();
  const firstName = argument("--first-name");
  const lastName = process.argv.includes("--last-name") ? argument("--last-name") : null;
  const requestedModuleKeys = argument("--modules").split(",").map((value) => value.trim()).filter(Boolean);
  const moduleKeys = [...new Set(requestedModuleKeys.flatMap((moduleKey) => activationGroupFor(moduleKey)))];
  if (!moduleKeys.includes("superadmin_center")) throw new Error("The first workspace must enable superadmin_center.");

  const [workspaceCount, superadminCount, existingUser, modules, dependencies, superadminRole] = await Promise.all([
    prisma.workspace.count({ where: { deleted_at: null } }),
    prisma.userWorkspaceRole.count({ where: { role: { key: "superadmin" }, user: { deleted_at: null } } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.module.findMany({ where: { key: { in: moduleKeys }, is_active: true }, select: { id: true, key: true } }),
    prisma.moduleDependency.findMany({ include: { module: { select: { key: true } }, depends_on_module: { select: { key: true } } } }),
    prisma.role.findUnique({ where: { key: "superadmin" }, select: { id: true } }),
  ]);
  if (workspaceCount > 0 || superadminCount > 0) throw new Error("Initial setup is allowed only when no active workspace and no superadmin exist.");
  if (existingUser) throw new Error(`User '${email}' already exists.`);
  if (!superadminRole) throw new Error("System catalog is missing. Wait for app startup, then retry.");
  const missing = moduleKeys.filter((key) => !modules.some((module) => module.key === key));
  if (missing.length) throw new Error(`Unknown or inactive module keys: ${missing.join(", ")}`);
  for (const dependency of dependencies) if (moduleKeys.includes(dependency.module.key) && !moduleKeys.includes(dependency.depends_on_module.key)) throw new Error(`Module '${dependency.module.key}' requires '${dependency.depends_on_module.key}'.`);

  const hash = await passwordHash(argument("--password"));
  const profile = createInstallationProfile([{ workspace_code: workspaceCode, enabled_modules: moduleKeys }]);
  const profileHash = hashInstallationProfile(profile);
  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { code: organizationCode, legal_name: organizationName } });
    const workspace = await tx.workspace.create({ data: { organization_id: organization.id, code: workspaceCode, name: workspaceName, is_active: true } });
    const user = await tx.user.create({ data: { email, first_name: firstName, last_name: lastName, password_hash: hash, must_change_password: true, is_active: true } });
    await tx.workspaceMembership.create({ data: { workspace_id: workspace.id, user_id: user.id, status: "ACTIVE" } });
    await tx.userWorkspaceRole.create({ data: { workspace_id: workspace.id, user_id: user.id, role_id: superadminRole.id } });
    await tx.userPreference.create({ data: { workspace_id: workspace.id, user_id: user.id, palette_id: "predefinito", language_code: "it" } });
    await tx.workspaceModule.createMany({ data: modules.map((module) => ({ workspace_id: workspace.id, module_id: module.id, is_enabled: true, configured_by_user_id: user.id })) });
    await tx.projectStatus.createMany({ data: [{ workspace_id: workspace.id, key: "in_revisione", label: "In Revisione" }, { workspace_id: workspace.id, key: "completato", label: "Completato" }, { workspace_id: workspace.id, key: "in_attesa", label: "In Attesa" }] });
    await tx.projectRevision.createMany({ data: [{ workspace_id: workspace.id, code: "v1" }, { workspace_id: workspace.id, code: "v2" }] });
    const snapshot = await tx.installationProfileSnapshot.create({
      data: {
        version: 1,
        profile_hash: profileHash,
        source: "initialization",
        normalized_profile: profile as Prisma.InputJsonValue,
      },
    });
    return { organization: organization.code, workspace: workspace.code, email: user.email, modules: modules.map((module) => module.key), installation_profile: { version: snapshot.version, hash: snapshot.profile_hash } };
  });
  console.log(JSON.stringify({ ...result, message: "Initial superuser created. The password must be changed at first login." }, null, 2));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
