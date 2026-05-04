import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/organisms";
import { AUTH_CONFIGURED_COOKIE_NAME } from "@/lib/auth/constants";
import { APP_ROUTES } from "@/lib/routes";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIGURED_COOKIE_NAME)?.value;
  if (token) {
    redirect(APP_ROUTES.dashboard);
  }

  return <LoginForm />;
}
