export default async function DashboardPage() {
  const { WorkspaceDashboardPanel } = await import("@/components/organisms");
  return <WorkspaceDashboardPanel />;
}
