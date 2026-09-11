import { CommissionRecordDetailPanel } from "@/components/organisms";

export default async function CommissionRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CommissionRecordDetailPanel id={id} />;
}
