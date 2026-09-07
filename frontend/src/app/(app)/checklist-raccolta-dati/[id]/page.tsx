import { CommissionDetailPanel } from "@/components/organisms";

export default async function DataCollectionChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CommissionDetailPanel id={id} />;
}
