import { ProjectForm } from "@/components/organisms";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectForm id={id} />;
}
