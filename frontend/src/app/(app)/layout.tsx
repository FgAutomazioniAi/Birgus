import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { AUTH_CONFIGURED_COOKIE_NAME } from "@/lib/auth/constants";
import { APP_ROUTES } from "@/lib/routes";

const getApiBaseUrl = () =>
  (process.env.BIRGUS_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIGURED_COOKIE_NAME)?.value;
  if (!token) {
    redirect(APP_ROUTES.login);
  }

  let currentUserName = "Utente";
  let currentUserId = "";
  let currentUserRole = "Operatore";
  let isSuperadmin = false;
  let currentWorkspaceId = "";
  let enabledModuleKeys: string[] = [];
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/session`, {
      cache: "no-store",
      headers: {
        cookie: `${AUTH_CONFIGURED_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
    });

    if (!response.ok) {
      redirect(APP_ROUTES.login);
    }

    const payload = (await response.json()) as {
      workspaceId?: string;
      userId?: string;
      user?: { fullName?: string; roleKeys?: string[] };
    };
    const fullName = payload.user?.fullName?.trim();
    if (fullName && fullName.length > 0) {
      currentUserName = fullName;
    }

    currentWorkspaceId = payload.workspaceId?.trim() ?? "";

    const normalizedRoleKeys = (payload.user?.roleKeys ?? []).map((item) => item.trim().toLowerCase());
    if (normalizedRoleKeys.includes("superadmin")) {
      currentUserRole = "Superadmin";
      isSuperadmin = true;
    } else if (normalizedRoleKeys.includes("admin")) {
      currentUserRole = "Admin";
    } else if (normalizedRoleKeys.includes("operator")) {
      currentUserRole = "Operatore";
    }

    currentUserId = payload.userId?.trim() ?? "";

    if (currentUserId) {
      const modulesResponse = await fetch(`${getApiBaseUrl()}/api/modules/users/${encodeURIComponent(currentUserId)}`, {
        cache: "no-store",
        headers: {
          cookie: `${AUTH_CONFIGURED_COOKIE_NAME}=${encodeURIComponent(token)}`,
          ...(currentWorkspaceId ? { "x-workspace-id": currentWorkspaceId } : {}),
        },
      });

      if (modulesResponse.ok) {
        const modulesPayload = (await modulesResponse.json()) as {
          modules?: Array<{ effectiveEnabled?: boolean; moduleKey?: string }>;
        };

        enabledModuleKeys = (modulesPayload.modules ?? [])
          .filter((item) => item.effectiveEnabled && typeof item.moduleKey === "string")
          .map((item) => item.moduleKey as string);
      }
    }
  } catch {
    redirect(APP_ROUTES.login);
  }

  return (
    <AppShell
      currentUser={{
        id: currentUserId,
        nome: currentUserName,
        ruolo: currentUserRole,
        isSuperadmin,
        workspaceId: currentWorkspaceId,
        enabledModuleKeys,
      }}
    >
      {children}
    </AppShell>
  );
}
