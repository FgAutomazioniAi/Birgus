import { ShippingPanel } from "@/components/organisms";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = await params;
  return <ShippingPanel shipmentId={shipmentId} />;
}
