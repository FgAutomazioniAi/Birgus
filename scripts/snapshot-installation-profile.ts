import { Prisma, PrismaClient } from "@prisma/client";
import { createInstallationProfile, hashInstallationProfile } from "./installation-profile.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const workspaces = await prisma.workspace.findMany({
    where: { deleted_at: null, is_active: true },
    select: {
      code: true,
      workspace_modules: {
        where: { is_enabled: true },
        select: { module: { select: { key: true } } },
      },
    },
  });
  if (workspaces.length === 0) throw new Error("No active workspace exists. Run instance:initialize first.");

  const profile = createInstallationProfile(workspaces.map((workspace) => ({
    workspace_code: workspace.code,
    enabled_modules: workspace.workspace_modules.map(({ module }) => module.key),
  })));
  const profileHash = hashInstallationProfile(profile);
  const existing = await prisma.installationProfileSnapshot.findUnique({ where: { profile_hash: profileHash } });
  if (existing) {
    console.log(JSON.stringify({ status: "unchanged", version: existing.version, profile_hash: existing.profile_hash }, null, 2));
    return;
  }

  const latest = await prisma.installationProfileSnapshot.aggregate({ _max: { version: true } });
  const snapshot = await prisma.installationProfileSnapshot.create({
    data: {
      version: (latest._max.version ?? 0) + 1,
      profile_hash: profileHash,
      source: "runtime-reconciliation",
      normalized_profile: profile as Prisma.InputJsonValue,
    },
  });
  console.log(JSON.stringify({ status: "created", version: snapshot.version, profile_hash: snapshot.profile_hash }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
