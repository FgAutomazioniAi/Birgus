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

    const payload = (await response.json()) as { user?: { fullName?: string } };
    const fullName = payload.user?.fullName?.trim();
    if (fullName && fullName.length > 0) {
      currentUserName = fullName;
    }
  } catch {
    redirect(APP_ROUTES.login);
  }

  return <AppShell currentUser={{ nome: currentUserName, ruolo: "Operatore" }}>{children}</AppShell>;
}
