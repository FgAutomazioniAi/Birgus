import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const versions = await prisma.projectVersion.findMany({
    where: {
      deleted_at: null,
      shipment: null,
    },
    select: {
      id: true,
      workspace_id: true,
      version_label: true,
      client_id: true,
    },
    orderBy: [
      { workspace_id: "asc" },
      { id: "asc" },
    ],
  });

  if (versions.length === 0) {
    console.log("No project versions require shipment backfill.");
    return;
  }

  let createdCount = 0;

  for (const version of versions) {
    const status = await prisma.shipmentStatus.findFirst({
      where: {
        workspace_id: version.workspace_id,
        key: "draft",
      },
      select: {
        id: true,
      },
    });

    if (!status) {
      throw new Error(`Missing shipment status 'draft' for workspace ${version.workspace_id}.`);
    }

    await prisma.shipment.create({
      data: {
        workspace_id: version.workspace_id,
        project_version_id: version.id,
        code: `SP-PV${version.id}-${version.version_label.toUpperCase()}`,
        client_id: version.client_id,
        status_id: status.id,
      },
    });

    createdCount += 1;
  }

  console.log(`Backfill completed. Created ${createdCount} shipments.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
