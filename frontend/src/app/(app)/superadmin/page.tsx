import { cookies } from "next/headers";

import { NotFoundPanel, SuperadminPanel } from "@/components/organisms";
import { AUTH_CONFIGURED_COOKIE_NAME } from "@/lib/auth/constants";

const getApiBaseUrl = () =>
  (process.env.BIRGUS_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function SuperadminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIGURED_COOKIE_NAME)?.value;
  if (!token) {
    return <NotFoundPanel />;
  }

  try {
    const sessionResponse = await fetch(`${getApiBaseUrl()}/api/auth/session`, {
      cache: "no-store",
      headers: {
        cookie: `${AUTH_CONFIGURED_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
    });

    if (!sessionResponse.ok) {
      return <NotFoundPanel />;
    }

    const sessionPayload = (await sessionResponse.json()) as {
      userId?: string;
      user?: { roleKeys?: string[] };
    };

    const userId = sessionPayload.userId?.trim() ?? "";
    const isSuperadmin = (sessionPayload.user?.roleKeys ?? []).some((item) => item.trim().toLowerCase() === "superadmin");
    if (!isSuperadmin || !userId) {
      return <NotFoundPanel />;
    }

    const modulesResponse = await fetch(`${getApiBaseUrl()}/api/modules/users/${encodeURIComponent(userId)}`, {
      cache: "no-store",
      headers: {
        cookie: `${AUTH_CONFIGURED_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
    });

    if (!modulesResponse.ok) {
      return <NotFoundPanel />;
    }

    const modulesPayload = (await modulesResponse.json()) as {
      modules?: Array<{ moduleKey?: string; effectiveEnabled?: boolean }>;
    };

    const hasEnabledSuperadminModule = (modulesPayload.modules ?? []).some(
      (item) => item.moduleKey === "superadmin_center" && item.effectiveEnabled,
    );

    if (!hasEnabledSuperadminModule) {
      return <NotFoundPanel />;
    }
  } catch {
    return <NotFoundPanel />;
  }

  return <SuperadminPanel />;
}
