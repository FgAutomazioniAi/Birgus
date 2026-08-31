import { cookies } from "next/headers";

import { NotFoundPanel, SuperadminPanel } from "@/components/organisms";
import { AUTH_CONFIGURED_COOKIE_NAME } from "@/lib/auth/constants";

const getApiBaseUrl = () =>
  (process.env.BIRGUS_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function SuperadminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIGURED_COOKIE_NAME)?.value;
  if (!token || !await canAccessSuperadmin(token)) {
    return <NotFoundPanel />;
  }

  return <SuperadminPanel />;
}

async function canAccessSuperadmin(token: string): Promise<boolean> {
  try {
    const sessionResponse = await fetch(`${getApiBaseUrl()}/api/auth/session`, {
      cache: "no-store",
      headers: {
        cookie: `${AUTH_CONFIGURED_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
    });

    if (!sessionResponse.ok) {
      return false;
    }

    const sessionPayload = (await sessionResponse.json()) as {
      workspaceId?: string;
      userId?: string;
      user?: { roleKeys?: string[] };
    };

    const userId = sessionPayload.userId?.trim() ?? "";
    const workspaceId = sessionPayload.workspaceId?.trim() ?? "";
    const isSuperadmin = (sessionPayload.user?.roleKeys ?? []).some((item) => item.trim().toLowerCase() === "superadmin");
    if (!isSuperadmin || !userId) {
      return false;
    }

    const modulesResponse = await fetch(`${getApiBaseUrl()}/api/modules/users/${encodeURIComponent(userId)}`, {
      cache: "no-store",
      headers: {
        cookie: `${AUTH_CONFIGURED_COOKIE_NAME}=${encodeURIComponent(token)}`,
        ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
      },
    });

    if (!modulesResponse.ok) {
      return false;
    }

    const modulesPayload = (await modulesResponse.json()) as {
      modules?: Array<{ moduleKey?: string; effectiveEnabled?: boolean }>;
    };

    return (modulesPayload.modules ?? []).some(
      (item) => item.moduleKey === "superadmin_center" && item.effectiveEnabled,
    );
  } catch {
    return false;
  }
}
