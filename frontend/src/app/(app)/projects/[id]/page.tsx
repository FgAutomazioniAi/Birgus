import { ProjectVersionsTable } from "@/components/organisms";

export default async function ProjectVersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectVersionsTable id={id} />;
}
