import { ClientForm } from "@/components/organisms";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientForm id={id} />;
}
