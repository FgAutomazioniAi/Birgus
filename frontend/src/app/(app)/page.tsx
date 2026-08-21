import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardTable } from "@/components/organisms";
import { AUTH_CONFIGURED_COOKIE_NAME } from "@/lib/auth/constants";
import { APP_ROUTES } from "@/lib/routes";

const getApiBaseUrl = () =>
  (process.env.BIRGUS_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function DashboardPage() {
  const token = (await cookies()).get(AUTH_CONFIGURED_COOKIE_NAME)?.value;
  if (!token) {
    redirect(APP_ROUTES.login);
  }

  const sessionResponse = await fetch(`${getApiBaseUrl()}/api/auth/session`, {
    cache: "no-store",
    headers: { cookie: `${AUTH_CONFIGURED_COOKIE_NAME}=${encodeURIComponent(token)}` },
  });
  if (!sessionResponse.ok) {
    redirect(APP_ROUTES.login);
  }

  const sessionPayload = (await sessionResponse.json()) as { workspaceId?: string; userId?: string };
  const userId = sessionPayload.userId?.trim() ?? "";
  const workspaceId = sessionPayload.workspaceId?.trim() ?? "";
  if (!userId) {
    redirect(APP_ROUTES.personalDashboard);
  }

  const modulesResponse = await fetch(`${getApiBaseUrl()}/api/modules/users/${encodeURIComponent(userId)}`, {
    cache: "no-store",
    headers: {
      cookie: `${AUTH_CONFIGURED_COOKIE_NAME}=${encodeURIComponent(token)}`,
      ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
    },
  });
  if (!modulesResponse.ok) {
    redirect(APP_ROUTES.personalDashboard);
  }

  const modulesPayload = (await modulesResponse.json()) as {
    modules?: Array<{ moduleKey?: string; effectiveEnabled?: boolean }>;
  };
  const canViewProjects = (modulesPayload.modules ?? []).some(
    (module) => module.moduleKey === "project_management" && module.effectiveEnabled,
  );
  if (!canViewProjects) {
    redirect(APP_ROUTES.personalDashboard);
  }

  return <DashboardTable />;
}
