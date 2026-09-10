import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { APP_VERSION } from "@/lib/app-version";
import { AUTH_CONFIGURED_COOKIE_NAME } from "@/lib/auth/constants";
import { APP_ROUTES } from "@/lib/routes";

const getApiBaseUrl = () =>
  (process.env.BIRGUS_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIGURED_COOKIE_NAME)?.value;
  if (token) {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/session`, {
        cache: "no-store",
        headers: { cookie: `${AUTH_CONFIGURED_COOKIE_NAME}=${encodeURIComponent(token)}` },
      });
      if (response.ok) redirect(APP_ROUTES.dashboard);
    } catch {
      // Render the landing page when a stale browser cookie cannot be validated.
    }
  }

  return <LandingPage version={APP_VERSION} />;
}
